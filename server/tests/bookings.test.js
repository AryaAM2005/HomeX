import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

const uploadDir = await mkdtemp(path.join(os.tmpdir(), 'homex-bookings-'));

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://unused/homex';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
process.env.UPLOAD_DIR = uploadDir;

// Imported after the variables above, because env.js reads them on load.
const { app } = await import('../app.js');
const { expireUnansweredBookings } = await import('../jobs/careJob.js');
const { generateWellnessReports } = await import('../jobs/wellnessJob.js');
const { Alert } = await import('../models/Alert.js');
const { Assignment } = await import('../models/Assignment.js');
const { Booking } = await import('../models/Booking.js');
const { CaregiverProfile } = await import('../models/CaregiverProfile.js');
const { CareReport } = await import('../models/CareReport.js');
const { CheckIn } = await import('../models/CheckIn.js');
const { Notification } = await import('../models/Notification.js');
const { Parent } = await import('../models/Parent.js');
const { Payment } = await import('../models/Payment.js');
const { Plan } = await import('../models/Plan.js');
const { Review } = await import('../models/Review.js');
const { Subscription } = await import('../models/Subscription.js');
const { User } = await import('../models/User.js');
const { WellnessReport } = await import('../models/WellnessReport.js');
const { ensurePlans } = await import('../utils/ensurePlans.js');
const { addDays, addIstMinutes, istDate, mondayOf } = await import('../utils/time.js');

const HOME = { lat: 20.288, lng: 85.844 };
const PDF = Buffer.from('%PDF-1.4 test');
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => ({
  day,
  start: '00:00',
  end: '23:59',
}));

let accountCount = 0;

async function signUp(role = 'customer', name) {
  accountCount += 1;
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({
      name: name ?? `Person ${accountCount}`,
      email: `person${accountCount}@example.com`,
      phone: '9876543210',
      password: 'correct-horse',
      role: role === 'caregiver' ? 'caregiver' : 'customer',
      consent: true,
    })
    .expect(201);

  if (role === 'admin' || role === 'careManager') {
    await User.updateOne({ _id: res.body.user.id }, { role });
  }
  return { agent, user: res.body.user };
}

async function addCaregiver(profile = {}) {
  const caregiver = await signUp('caregiver', 'Sunita Behera');
  await CaregiverProfile.create({
    userId: caregiver.user.id,
    services: ['doctor_visit', 'lab_test', 'companionship', 'post_hospital'],
    languages: ['Odia'],
    location: { type: 'Point', coordinates: [HOME.lng, HOME.lat] },
    serviceRadiusKm: 10,
    availability: EVERY_DAY,
    verificationStatus: 'approved',
    ...profile,
  });
  return caregiver;
}

async function createFamily({ planName } = {}) {
  const customer = await signUp('customer', 'Ravi Das');
  const caregiver = await addCaregiver();

  const created = await customer.agent
    .post('/api/parents')
    .send({
      name: 'Lakshmi Das',
      age: 72,
      address: '12 Saheed Nagar',
      location: HOME,
      conditions: ['Diabetes'],
      emergencyContact: { name: 'Ravi Das', phone: '9876511111' },
    })
    .expect(201);
  const parentId = created.body.parent.id;

  if (planName) {
    await Subscription.create({
      customerId: customer.user.id,
      parentId,
      planId: (await Plan.findOne({ name: planName })).id,
      billingCycle: 'monthly',
      currency: 'INR',
      status: 'active',
      renewsAt: new Date(Date.now() + 30 * 86_400_000),
      createdAt: new Date(Date.now() - 60 * 86_400_000),
    });
  }
  return { customer, caregiver, parentId };
}

const inHours = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();

const book = (family, overrides = {}) =>
  family.customer.agent.post('/api/bookings').send({
    parentId: family.parentId,
    caregiverId: family.caregiver.user.id,
    serviceType: 'doctor_escort',
    currency: 'INR',
    scheduledAt: inHours(24),
    ...overrides,
  });

const act = (person, bookingId, action, extra = {}) =>
  person.agent.patch(`/api/bookings/${bookingId}/status`).send({ action, ...extra });

async function bookAndFinish(family, overrides) {
  const { id } = (await book(family, overrides).expect(201)).body.booking;
  await act(family.caregiver, id, 'accept').expect(200);
  await act(family.caregiver, id, 'fix_appointment', { note: 'Dr Mohanty at 11:30' }).expect(200);
  await act(family.caregiver, id, 'start').expect(200);
  await act(family.caregiver, id, 'complete').expect(200);
  return id;
}

const REPORT = {
  doctorName: 'Dr A Mohanty',
  hospital: 'City Clinic',
  diagnosisSummary: 'Blood pressure is steady. Continue the current medicine.',
  vitals: { bpSystolic: 130, bpDiastolic: 84 },
  prescriptions: 'Amlodipine 5 mg daily',
  nextFollowUp: '2026-12-01',
};

const submitReport = (family, id, overrides = {}) =>
  family.caregiver.agent
    .post(`/api/bookings/${id}/report`)
    .field('data', JSON.stringify({ ...REPORT, ...overrides }));

describe('bookings, reports and reviews', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all(
      [User, Plan, Subscription, CaregiverProfile, CareReport, Review, WellnessReport].map((m) =>
        m.init(),
      ),
    );
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
    await rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await Promise.all(
      [
        Alert,
        Assignment,
        Booking,
        CaregiverProfile,
        CareReport,
        CheckIn,
        Notification,
        Parent,
        Payment,
        Plan,
        Review,
        Subscription,
        User,
        WellnessReport,
      ].map((model) => model.deleteMany({})),
    );
    await ensurePlans();
  });

  describe('FR-25 booking a service', () => {
    it('charges a family with no plan, and records the payment', async () => {
      const family = await createFamily();
      const res = await book(family).expect(201);

      const booking = await Booking.findById(res.body.booking.id);
      assert.equal(booking.status, 'REQUESTED');
      assert.equal(booking.paymentStatus, 'paid');
      assert.equal(booking.price, 699);

      const payment = await Payment.findOne();
      assert.equal(payment.amount, 699);
      assert.equal(payment.description, 'Doctor visit escort');
    });

    it('includes services the plan covers, and charges for those it does not', async () => {
      const family = await createFamily({ planName: 'Standard' });

      await book(family).expect(201);
      assert.equal(await Payment.countDocuments(), 0);

      await book(family, { serviceType: 'companionship' }).expect(201);
      assert.equal(await Payment.countDocuments(), 1);
    });

    it('covers more on Premium and nothing on Basic', async () => {
      const premium = await createFamily({ planName: 'Premium' });
      await book(premium, { serviceType: 'post_hospital' }).expect(201);
      assert.equal(await Payment.countDocuments(), 0);

      const basic = await createFamily({ planName: 'Basic' });
      await book(basic).expect(201);
      assert.equal(await Payment.countDocuments(), 1);
    });

    it('quotes the price before booking, using credit', async () => {
      const family = await createFamily();
      await User.updateOne({ _id: family.customer.user.id }, { credit: 200 });

      const res = await family.customer.agent
        .post('/api/bookings/quote')
        .send({ parentId: family.parentId, serviceType: 'doctor_escort', currency: 'INR' })
        .expect(200);

      assert.equal(res.body.quote.base, 699);
      assert.equal(res.body.quote.creditApplied, 200);
      assert.equal(res.body.quote.total, 499);
      assert.equal(res.body.quote.includedIn, null);
    });

    it('prices visits in USD, and takes credit from a paid visit', async () => {
      const family = await createFamily();
      await User.updateOne({ _id: family.customer.user.id }, { credit: 100 });

      await book(family, { serviceType: 'lab_test', currency: 'USD' }).expect(201);
      const payment = await Payment.findOne();

      assert.equal(payment.currency, 'USD');
      assert.equal(payment.creditUsedInr, 100);
      assert.equal(payment.amount, 4.8);
      assert.equal((await User.findById(family.customer.user.id)).credit, 0);
    });

    it('refuses a caregiver who does not offer it, or is too far away', async () => {
      const family = await createFamily();
      const noLabs = await addCaregiver({ services: ['companionship'] });
      const farAway = await addCaregiver({
        location: { type: 'Point', coordinates: [85.8312, 19.8135] },
      });

      await book(family, { caregiverId: noLabs.user.id }).expect(409);
      await book(family, { caregiverId: farAway.user.id }).expect(409);
      assert.equal(await Booking.countDocuments(), 0);
    });

    it('refuses an unverified caregiver', async () => {
      const family = await createFamily();
      await CaregiverProfile.updateOne({}, { verificationStatus: 'pending' });
      await book(family).expect(404);
    });

    it('needs an hour of notice and a time within working hours', async () => {
      const family = await createFamily();
      await book(family, { scheduledAt: inHours(0.5) }).expect(400);

      await CaregiverProfile.updateOne(
        {},
        { availability: [{ day: 'mon', start: '10:00', end: '10:01' }] },
      );
      const monday = addIstMinutes(addDays(mondayOf(istDate()), 7), '15:00', 0).toISOString();
      const res = await book(family, { scheduledAt: monday }).expect(409);
      assert.ok(res.body.error.fields.scheduledAt);
    });

    it('lets an emergency visit go ahead right now, at any hour', async () => {
      const family = await createFamily();
      await CaregiverProfile.updateOne({}, { availability: [] });
      await book(family, { serviceType: 'emergency_visit', scheduledAt: inHours(0) }).expect(201);
    });

    it("cannot book for someone else's parent", async () => {
      const family = await createFamily();
      const other = await signUp();
      await other.agent
        .post('/api/bookings')
        .send({
          parentId: family.parentId,
          caregiverId: family.caregiver.user.id,
          serviceType: 'lab_test',
          currency: 'INR',
          scheduledAt: inHours(24),
        })
        .expect(404);
    });

    it('needs a map pin first', async () => {
      const family = await createFamily();
      await Parent.updateOne({}, { $unset: { location: 1 } });
      await book(family).expect(409);
    });
  });

  describe('FR-26 status flow', () => {
    it('moves through every step, with a timestamped history', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);
      await submitReport(family, id).expect(201);

      const booking = await Booking.findById(id);
      assert.deepEqual(
        booking.statusHistory.map(({ status }) => status),
        ['REQUESTED', 'ACCEPTED', 'APPOINTMENT_FIXED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_SUBMITTED'],
      );
      assert.ok(booking.statusHistory.every(({ at }) => at instanceof Date));
      assert.equal(booking.appointmentDetails, 'Dr Mohanty at 11:30');
    });

    it('notifies the family of every change', async () => {
      const family = await createFamily();
      await bookAndFinish(family);
      assert.equal(await Notification.countDocuments({ userId: family.customer.user.id }), 4);
    });

    it('refuses steps out of order', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;

      await act(family.caregiver, id, 'complete').expect(409);
      await act(family.caregiver, id, 'accept').expect(200);
      await act(family.caregiver, id, 'accept').expect(409);
      await act(family.caregiver, id, 'start').expect(409);
    });

    it('skips the appointment step for non-medical visits', async () => {
      const family = await createFamily();
      const { id } = (await book(family, { serviceType: 'companionship' })).body.booking;

      await act(family.caregiver, id, 'accept').expect(200);
      await act(family.caregiver, id, 'fix_appointment', { note: 'Not needed here' }).expect(409);
      await act(family.caregiver, id, 'start').expect(200);
      await act(family.caregiver, id, 'complete').expect(200);
      await submitReport(family, id).expect(409);
    });

    it('needs appointment details', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await act(family.caregiver, id, 'accept').expect(200);
      await act(family.caregiver, id, 'fix_appointment').expect(400);
    });

    it('lets the family cancel before the visit starts, with a refund', async () => {
      const family = await createFamily();
      await User.updateOne({ _id: family.customer.user.id }, { credit: 100 });
      const { id } = (await book(family)).body.booking;
      await act(family.caregiver, id, 'accept').expect(200);

      await act(family.customer, id, 'cancel').expect(200);

      assert.equal((await Booking.findById(id)).paymentStatus, 'refunded');
      assert.equal((await Payment.findOne()).status, 'refunded');
      assert.equal((await User.findById(family.customer.user.id)).credit, 100);
    });

    it('does not allow cancelling once the visit has started', async () => {
      const family = await createFamily();
      const { id } = (await book(family, { serviceType: 'companionship' })).body.booking;
      await act(family.caregiver, id, 'accept').expect(200);
      await act(family.caregiver, id, 'start').expect(200);
      await act(family.customer, id, 'cancel').expect(409);
    });

    it('refunds a rejected booking', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;

      await act(family.caregiver, id, 'reject', { note: 'Away that day' }).expect(200);

      assert.equal((await Booking.findById(id)).status, 'REJECTED');
      assert.equal((await Payment.findOne()).status, 'refunded');
    });

    it('keeps each side to its own actions and bookings', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      const stranger = await addCaregiver();

      await act(family.customer, id, 'accept').expect(403);
      await act(family.caregiver, id, 'cancel').expect(403);
      await act(stranger, id, 'accept').expect(404);
    });

    it('refunds and clears a request nobody answered in time', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;

      await expireUnansweredBookings(new Date(Date.now() + 2 * 86_400_000));

      assert.equal((await Booking.findById(id)).status, 'REJECTED');
      assert.equal((await Payment.findOne()).status, 'refunded');
    });

    it('leaves accepted bookings alone when clearing requests', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await act(family.caregiver, id, 'accept').expect(200);

      await expireUnansweredBookings(new Date(Date.now() + 2 * 86_400_000));
      assert.equal((await Booking.findById(id)).status, 'ACCEPTED');
    });
  });

  describe('privacy of booking details', () => {
    it('hides health details and contacts until the caregiver accepts', async () => {
      const family = await createFamily();
      const { id } = (await book(family, { notes: 'Bring old reports' })).body.booking;

      const before = (await family.caregiver.agent.get('/api/bookings')).body.bookings[0];
      assert.equal(before.parent.name, 'Lakshmi');
      assert.equal(before.parent.address, undefined);
      assert.equal(before.parent.conditions, undefined);
      assert.equal(before.family, null);

      const hidden = (await family.customer.agent.get('/api/bookings')).body.bookings[0];
      assert.equal(hidden.caregiver.phone, null);

      await act(family.caregiver, id, 'accept').expect(200);

      const after = (await family.caregiver.agent.get('/api/bookings')).body.bookings[0];
      assert.deepEqual(after.parent.conditions, ['Diabetes']);
      assert.equal(after.family.phone, '9876543210');

      const shown = (await family.customer.agent.get('/api/bookings')).body.bookings[0];
      assert.equal(shown.caregiver.phone, '9876543210');

      const profile = await family.customer.agent.get(`/api/caregivers/${family.caregiver.user.id}`);
      assert.equal(profile.body.caregiver.phone, '9876543210');
    });

    it('hides the phone again when a booking was only ever rejected', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await act(family.caregiver, id, 'reject').expect(200);

      const profile = await family.customer.agent.get(`/api/caregivers/${family.caregiver.user.id}`);
      assert.equal(profile.body.caregiver.phone, null);
    });

    it('shows each person only their own bookings', async () => {
      const family = await createFamily();
      await book(family).expect(201);
      const other = await signUp();
      assert.equal((await other.agent.get('/api/bookings')).body.bookings.length, 0);
    });

    it('refuses to remove a parent with an open booking', async () => {
      const family = await createFamily();
      await book(family).expect(201);
      await family.customer.agent.delete(`/api/parents/${family.parentId}`).expect(409);
    });

    it('keeps old bookings working after a parent is removed', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await act(family.customer, id, 'cancel').expect(200);
      await family.customer.agent.delete(`/api/parents/${family.parentId}`).expect(204);

      const res = await family.customer.agent.get('/api/bookings').expect(200);
      assert.equal(res.body.bookings[0].parent.name, 'Removed parent');
      await family.caregiver.agent.get('/api/bookings').expect(200);
    });
  });

  describe('FR-27 care reports', () => {
    it('saves a report with attachments, and shows it to the family', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);

      await submitReport(family, id).attach('attachments', PDF, 'prescription.pdf').expect(201);

      assert.equal((await Booking.findById(id)).status, 'REPORT_SUBMITTED');

      const res = await family.customer.agent.get(`/api/parents/${family.parentId}/reports`).expect(200);
      const [report] = res.body.careReports;
      assert.equal(report.doctorName, 'Dr A Mohanty');
      assert.equal(report.service, 'Doctor visit escort');
      assert.equal(report.caregiverName, 'Sunita Behera');
      assert.equal(report.nextFollowUp, '2026-12-01');
      assert.equal(report.attachments[0].name, 'prescription.pdf');
    });

    it('notifies the family', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);
      await submitReport(family, id).expect(201);
      assert.equal(await Notification.countDocuments({ title: 'New care report' }), 1);
    });

    it('only accepts a report once the visit is finished, and only once', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await act(family.caregiver, id, 'accept').expect(200);
      await submitReport(family, id).expect(409);

      const finished = await bookAndFinish(family);
      await submitReport(family, finished).expect(201);
      await submitReport(family, finished).expect(409);
    });

    it('checks the details and files', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);

      await submitReport(family, id, { diagnosisSummary: 'x' }).expect(400);
      await submitReport(family, id)
        .attach('attachments', Buffer.from('<script>'), 'fake.pdf')
        .expect(400);
      assert.equal(await CareReport.countDocuments(), 0);
    });

    it('only lets the booking caregiver file it', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);
      const stranger = await addCaregiver();

      await stranger.agent
        .post(`/api/bookings/${id}/report`)
        .field('data', JSON.stringify(REPORT))
        .expect(404);
    });

    it('raises an alert for abnormal readings in a report', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);

      await submitReport(family, id, { vitals: { sugar: 320 } }).expect(201);
      assert.match((await Alert.findOne({ type: 'abnormal_vitals' })).message, /Blood sugar 320/);
    });

    it('NFR-3 keeps reports and their files inside the family', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);
      await submitReport(family, id).attach('attachments', PDF, 'lab.pdf').expect(201);

      const { careReports } = (
        await family.customer.agent.get(`/api/parents/${family.parentId}/reports`)
      ).body;
      const url = `/api/reports/${careReports[0].id}/attachments/${careReports[0].attachments[0].id}`;

      await family.customer.agent.get(url).expect(200);
      await family.caregiver.agent.get(url).expect(200);

      const other = await signUp();
      await other.agent.get(url).expect(404);
      await other.agent.get(`/api/parents/${family.parentId}/reports`).expect(404);
      await request(app).get(url).expect(401);
    });
  });

  describe('FR-28 weekly wellness reports', () => {
    const lastMonday = () => addDays(mondayOf(istDate()), -7);

    async function logCheckIn(family, date, fields = {}) {
      await CheckIn.create({
        parentId: family.parentId,
        caregiverId: family.caregiver.user.id,
        type: 'call',
        mood: 'good',
        time: addIstMinutes(date, '10:00', 0),
        date,
        ...fields,
      });
    }

    async function coveredFamily() {
      const family = await createFamily({ planName: 'Standard' });
      await Parent.updateOne(
        { _id: family.parentId },
        { primaryCaregiverId: family.caregiver.user.id },
      );
      return family;
    }

    it('summarises the last full week from check-ins', async () => {
      const family = await coveredFamily();
      const monday = lastMonday();

      await logCheckIn(family, monday, {
        mood: 'great',
        vitals: { bpSystolic: 130, bpDiastolic: 80, sugar: 110 },
        medicinesGiven: [
          { medicineId: new mongoose.Types.ObjectId(), name: 'A', time: '08:00', status: 'given' },
          { medicineId: new mongoose.Types.ObjectId(), name: 'A', time: '20:00', status: 'missed' },
        ],
      });
      await logCheckIn(family, addDays(monday, 1), {
        mood: 'great',
        vitals: { bpSystolic: 140, bpDiastolic: 90, sugar: 130 },
      });
      await logCheckIn(family, addDays(monday, 2), { mood: 'low' });
      await logCheckIn(family, addDays(monday, 7)); // this week, so not counted
      await logCheckIn(family, addDays(monday, -7), { vitals: { sugar: 100 } });

      await generateWellnessReports();

      const report = await WellnessReport.findOne();
      assert.equal(report.weekStart, monday);
      assert.equal(report.weekEnd, addDays(monday, 6));
      assert.equal(report.checkinCount, 3);
      assert.equal(report.expectedCheckins, 7);
      assert.equal(report.adherencePct, 50);
      assert.equal(report.vitalsTrend.bpSystolic.avg, 135);
      assert.equal(report.vitalsTrend.sugar.max, 130);
      assert.equal(report.vitalsTrend.sugar.change, 20);
      assert.match(report.summary, /3 of 7 expected check-ins/);
      assert.match(report.summary, /Mood was mostly great/);
      assert.match(report.summary, /135\/85/);
      assert.match(report.summary, /no alerts/);
    });

    it('creates one report a week however often the job runs', async () => {
      await coveredFamily();

      await generateWellnessReports();
      await generateWellnessReports();

      assert.equal(await WellnessReport.countDocuments(), 1);
      assert.equal(await Notification.countDocuments({ title: 'Weekly wellness report' }), 1);
    });

    it('skips families who joined this week, or have no caregiver', async () => {
      await createFamily({ planName: 'Standard' });
      const joined = await coveredFamily();
      // Written directly, because Mongoose treats createdAt as read-only.
      await Subscription.collection.updateOne(
        { parentId: new mongoose.Types.ObjectId(joined.parentId) },
        { $set: { createdAt: new Date() } },
      );

      await generateWellnessReports();
      assert.equal(await WellnessReport.countDocuments(), 0);
    });

    it('still reports a quiet week, so a gap gets noticed', async () => {
      await coveredFamily();
      await generateWellnessReports();

      const report = await WellnessReport.findOne();
      assert.equal(report.checkinCount, 0);
      assert.match(report.summary, /0 of 7/);
    });

    it('is shown to the family only', async () => {
      const family = await coveredFamily();
      await generateWellnessReports();

      const res = await family.customer.agent.get(`/api/parents/${family.parentId}/reports`);
      assert.equal(res.body.wellnessReports.length, 1);

      const other = await signUp();
      await other.agent.get(`/api/parents/${family.parentId}/reports`).expect(404);
    });
  });

  describe('FR-30 reviews', () => {
    const rate = (family, body) =>
      family.customer.agent
        .post('/api/reviews')
        .send({ caregiverId: family.caregiver.user.id, ...body });

    it('rates a finished visit once, and updates the average', async () => {
      const family = await createFamily();
      await CaregiverProfile.updateOne({}, { ratingAvg: 4, ratingCount: 3 });
      const id = await bookAndFinish(family);

      await rate(family, { bookingId: id, rating: 5, comment: 'Very kind' }).expect(201);
      await rate(family, { bookingId: id, rating: 1 }).expect(409);

      const profile = await CaregiverProfile.findOne();
      assert.equal(profile.ratingCount, 4);
      assert.equal(profile.ratingAvg, 4.25);

      const page = await family.customer.agent.get(`/api/caregivers/${family.caregiver.user.id}`);
      assert.equal(page.body.caregiver.reviews[0].comment, 'Very kind');
      assert.equal(page.body.caregiver.reviews[0].author, 'Ravi');

      const list = await family.customer.agent.get('/api/bookings');
      assert.equal(list.body.bookings[0].canReview, false);
    });

    it('waits until the visit has finished', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await rate(family, { bookingId: id, rating: 5 }).expect(409);
    });

    it('lets a family rate their regular caregiver once a month', async () => {
      const family = await createFamily();

      await rate(family, { rating: 4 }).expect(403);

      await Parent.updateOne({}, { primaryCaregiverId: family.caregiver.user.id });
      const before = await family.customer.agent.get('/api/parents');
      assert.equal(before.body.parents[0].canReviewPrimary, true);

      await rate(family, { rating: 4 }).expect(201);
      await rate(family, { rating: 5 }).expect(409);

      const after = await family.customer.agent.get('/api/parents');
      assert.equal(after.body.parents[0].canReviewPrimary, false);
    });

    it('checks the rating and stops strangers', async () => {
      const family = await createFamily();
      const id = await bookAndFinish(family);
      const other = await signUp();

      await rate(family, { bookingId: id, rating: 6 }).expect(400);
      await other.agent
        .post('/api/reviews')
        .send({ caregiverId: family.caregiver.user.id, bookingId: id, rating: 1 })
        .expect(404);
      await family.caregiver.agent
        .post('/api/reviews')
        .send({ caregiverId: family.caregiver.user.id, rating: 5 })
        .expect(403);
    });
  });

  describe('FR-31 earnings and billing', () => {
    it('counts finished bookings only, for that caregiver', async () => {
      const family = await createFamily();
      await bookAndFinish(family);
      await book(family, { serviceType: 'lab_test' }).expect(201);

      const res = await family.caregiver.agent.get('/api/caregivers/me/earnings').expect(200);
      assert.equal(res.body.completedCount, 1);
      assert.equal(res.body.totalInr, 559);
      assert.equal(res.body.items[0].parentName, 'Lakshmi Das');

      await family.customer.agent.get('/api/caregivers/me/earnings').expect(403);
    });

    it('shows refunds in payment history', async () => {
      const family = await createFamily();
      const { id } = (await book(family)).body.booking;
      await act(family.customer, id, 'cancel').expect(200);

      const res = await family.customer.agent.get('/api/subscriptions/payments').expect(200);
      assert.equal(res.body.payments[0].status, 'refunded');
    });
  });
});
