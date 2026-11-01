import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://unused/homex';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
process.env.CRON_SECRET = 'test-cron-secret';

// Imported after the variables above, because env.js reads them on load.
const { app } = await import('../app.js');
const {
  escalateUnansweredSos,
  flagMissedCheckIns,
  flagMissedMedicines,
  remindTrialEnding,
  sendMedicineReminders,
} = await import('../jobs/careJob.js');
const { Alert } = await import('../models/Alert.js');
const { Assignment } = await import('../models/Assignment.js');
const { CheckIn } = await import('../models/CheckIn.js');
const { JobRun } = await import('../models/JobRun.js');
const { LiveEvent } = await import('../models/LiveEvent.js');
const { Medicine } = await import('../models/Medicine.js');
const { Notification } = await import('../models/Notification.js');
const { Parent } = await import('../models/Parent.js');
const { Plan } = await import('../models/Plan.js');
const { Subscription } = await import('../models/Subscription.js');
const { User } = await import('../models/User.js');
const { ensurePlans } = await import('../utils/ensurePlans.js');
const { runAllDueJobs, runDueJobs } = await import('../utils/scheduler.js');
const { addIstMinutes, istDate, istMonth, istTime } = await import('../utils/time.js');
const { findAbnormalVitals } = await import('../utils/vitals.js');

const HOME = { lat: 20.288, lng: 85.844 };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HOUR = 60 * 60 * 1000;

let accountCount = 0;

async function signUp(role = 'customer') {
  accountCount += 1;
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({
      name: `Person ${accountCount}`,
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
  const cookie = res.headers['set-cookie'][0].split(';')[0];
  return { agent, cookie, user: res.body.user };
}

// A family with a daily plan, a caregiver and a care manager all in place.
async function createFamily({ planName = 'Standard', careManager = true } = {}) {
  const customer = await signUp();
  const caregiver = await signUp('caregiver');
  const manager = careManager ? await signUp('careManager') : null;

  const created = await customer.agent
    .post('/api/parents')
    .send({
      name: 'Lakshmi Das',
      age: 72,
      address: '12 Saheed Nagar',
      location: HOME,
      emergencyContact: { name: 'Ravi Das', phone: '9876511111' },
    })
    .expect(201);
  const parentId = created.body.parent.id;

  await Parent.updateOne(
    { _id: parentId },
    careManager
      ? { primaryCaregiverId: caregiver.user.id, careManagerId: manager.user.id }
      : { primaryCaregiverId: caregiver.user.id, $unset: { careManagerId: 1 } },
  );
  await Subscription.create({
    customerId: customer.user.id,
    parentId,
    planId: (await Plan.findOne({ name: planName })).id,
    billingCycle: 'monthly',
    currency: 'INR',
    status: 'active',
    renewsAt: new Date(Date.now() + 30 * 86_400_000),
  });
  await Assignment.create({
    parentId,
    customerId: customer.user.id,
    caregiverId: caregiver.user.id,
    requestedBy: customer.user.id,
    type: 'primary',
    status: 'accepted',
    respondedAt: new Date(Date.now() - 3 * 86_400_000),
  });

  return { customer, caregiver, manager, parentId };
}

const logCall = (caregiver, parentId, extra = {}) =>
  caregiver.agent
    .post('/api/checkins')
    .field('data', JSON.stringify({ parentId, type: 'call', mood: 'good', ...extra }));

const addMedicine = (agent, parentId, overrides = {}) =>
  agent.post(`/api/parents/${parentId}/medicines`).send({
    name: 'Metformin',
    dose: '500 mg',
    times: ['08:00', '20:00'],
    startDate: '2026-01-01',
    ...overrides,
  });

describe('check-ins, medicines and alerts', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all(
      [User, Parent, Plan, Alert, Notification, Subscription].map((model) => model.init()),
    );
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      [User, Parent, Plan, Alert, Assignment, CheckIn, Medicine, Notification, Subscription].map(
        (model) => model.deleteMany({}),
      ),
    );
    await ensurePlans();
  });

  describe('FR-19 logging a check-in', () => {
    it('logs a call with mood, vitals and notes', async () => {
      const { caregiver, parentId } = await createFamily();
      const res = await logCall(caregiver, parentId, {
        vitals: { bpSystolic: 128, bpDiastolic: 82, pulse: 76 },
        notes: 'Ate well today',
      }).expect(201);

      assert.equal(res.body.checkIn.type, 'call');
      assert.equal(res.body.checkIn.vitals.bpSystolic, 128);
      assert.equal(res.body.checkIn.date, istDate());
    });

    it('requires GPS and a photo for a visit', async () => {
      const { caregiver, parentId } = await createFamily();
      const body = { parentId, type: 'visit', mood: 'good' };

      const noLocation = await caregiver.agent
        .post('/api/checkins')
        .field('data', JSON.stringify(body))
        .expect(400);
      assert.ok(noLocation.body.error.fields.location);

      const noPhoto = await caregiver.agent
        .post('/api/checkins')
        .field('data', JSON.stringify({ ...body, location: HOME }))
        .expect(400);
      assert.ok(noPhoto.body.error.fields.photo);
    });

    it('records how far a visit was from home', async () => {
      const { caregiver, parentId } = await createFamily();
      const res = await caregiver.agent
        .post('/api/checkins')
        .field(
          'data',
          JSON.stringify({
            parentId,
            type: 'visit',
            mood: 'okay',
            location: { lat: 20.298, lng: 85.844 },
          }),
        )
        .attach('photo', PNG, 'visit.png')
        .expect(201);

      assert.ok(Math.abs(res.body.checkIn.distanceFromHomeM - 1112) < 5);
      assert.equal(res.body.checkIn.hasPhoto, true);
    });

    it('refuses a file that is not really an image', async () => {
      const { caregiver, parentId } = await createFamily();
      await caregiver.agent
        .post('/api/checkins')
        .field('data', JSON.stringify({ parentId, type: 'visit', mood: 'good', location: HOME }))
        .attach('photo', Buffer.from('<script>'), { filename: 'x.png', contentType: 'image/png' })
        .expect(400);
    });

    it('only lets the assigned caregiver log', async () => {
      const { customer, parentId } = await createFamily();
      const stranger = await signUp('caregiver');

      await logCall(stranger, parentId).expect(404);
      await customer.agent.post('/api/checkins').field('data', '{}').expect(403);
      await request(app).post('/api/checkins').field('data', '{}').expect(401);
    });

    it('checks vitals are believable', async () => {
      const { caregiver, parentId } = await createFamily();
      const res = await logCall(caregiver, parentId, { vitals: { pulse: 900 } }).expect(400);
      assert.ok(res.body.error.fields['vitals.pulse']);
    });
  });

  describe('FR-20 seeing check-ins', () => {
    it('shows the family the latest check-in, the month and adherence', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      const medicine = (await addMedicine(customer.agent, parentId)).body.medicine;
      const dose = (time, status) => ({ medicineId: medicine.id, time, status });

      await logCall(caregiver, parentId, {
        mood: 'great',
        medicines: [dose('08:00', 'given'), dose('20:00', 'missed')],
      }).expect(201);

      const res = await customer.agent.get(`/api/parents/${parentId}/checkins`).expect(200);
      assert.equal(res.body.latest.mood, 'great');
      assert.equal(res.body.checkIns.length, 1);
      assert.equal(res.body.adherencePct, 50);
      assert.equal(res.body.month, istMonth());
    });

    it('returns an empty month without losing the latest check-in', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      await logCall(caregiver, parentId).expect(201);

      const res = await customer.agent
        .get(`/api/parents/${parentId}/checkins`)
        .query({ month: '2020-01' })
        .expect(200);
      assert.equal(res.body.checkIns.length, 0);
      assert.equal(res.body.adherencePct, null);
      assert.ok(res.body.latest);
    });

    it('keeps 30 days of vitals for charts, across a month end', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      await logCall(caregiver, parentId, { vitals: { pulse: 80 } }).expect(201);
      const { caregiverId } = await CheckIn.findOne();
      const entry = (daysAgo, pulse) => {
        const time = new Date(Date.now() - daysAgo * 86_400_000);
        return {
          parentId,
          caregiverId,
          type: 'call',
          mood: 'good',
          time,
          date: istDate(time),
          vitals: { pulse },
        };
      };
      await CheckIn.create([entry(25, 70), entry(40, 60)]);

      const res = await customer.agent
        .get(`/api/parents/${parentId}/checkins`)
        .query({ month: '2020-01' })
        .expect(200);

      assert.deepEqual(
        res.body.recentVitals.map(({ vitals }) => vitals.pulse),
        [80, 70],
      );
    });

    it('NFR-3 keeps history and photos inside the family', async () => {
      const { customer, caregiver, manager, parentId } = await createFamily();
      const res = await caregiver.agent
        .post('/api/checkins')
        .field('data', JSON.stringify({ parentId, type: 'visit', mood: 'good', location: HOME }))
        .attach('photo', PNG, 'visit.png')
        .expect(201);
      const photo = `/api/checkins/${res.body.checkIn.id}/photo`;

      await customer.agent.get(photo).expect(200);
      await manager.agent.get(photo).expect(200);
      await caregiver.agent.get(photo).expect(200);

      const other = await signUp();
      await other.agent.get(photo).expect(404);
      await other.agent.get(`/api/parents/${parentId}/checkins`).expect(404);
      await request(app).get(photo).expect(401);
    });

    it("shows a caregiver today's families and doses", async () => {
      const { customer, caregiver, parentId } = await createFamily();
      const { medicine } = (await addMedicine(customer.agent, parentId)).body;
      await logCall(caregiver, parentId, {
        medicines: [{ medicineId: medicine.id, time: '08:00', status: 'given' }],
      }).expect(201);

      const res = await caregiver.agent.get('/api/checkins/today').expect(200);
      const [visit] = res.body.visits;
      assert.equal(visit.checkedInToday, true);
      assert.deepEqual(
        visit.doses.map(({ time, status }) => [time, status]),
        [
          ['08:00', 'given'],
          ['20:00', null],
        ],
      );
    });
  });

  describe('FR-21 medicines', () => {
    it('lets the family and the caregiver add and edit a schedule', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      await addMedicine(customer.agent, parentId).expect(201);
      const added = await addMedicine(caregiver.agent, parentId, { name: 'Amlodipine' }).expect(201);

      await caregiver.agent
        .put(`/api/parents/${parentId}/medicines/${added.body.medicine.id}`)
        .send({
          name: 'Amlodipine',
          dose: '5 mg',
          times: ['09:00'],
          startDate: '2026-01-01',
          endDate: '2026-01-02',
        })
        .expect(200);

      const res = await customer.agent.get(`/api/parents/${parentId}/medicines`).expect(200);
      const stopped = res.body.medicines.find(({ name }) => name === 'Amlodipine');
      assert.equal(res.body.medicines.length, 2);
      assert.equal(stopped.activeToday, false);
      assert.deepEqual(stopped.todayDoses, []);
    });

    it('stops a medicine straight away, even one that started today', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      const added = await addMedicine(customer.agent, parentId, {
        startDate: istDate(),
        times: ['08:00'],
      }).expect(201);
      const { id } = added.body.medicine;

      const stopped = await caregiver.agent
        .post(`/api/parents/${parentId}/medicines/${id}/stop`)
        .expect(200);
      assert.equal(stopped.body.medicine.stopped, true);
      assert.equal(stopped.body.medicine.activeToday, false);

      await logCall(caregiver, parentId, {
        medicines: [{ medicineId: id, time: '08:00', status: 'given' }],
      }).expect(400);

      await flagMissedMedicines(addIstMinutes(istDate(), '23:00', 0));
      assert.equal(await Alert.countDocuments({ type: 'missed_medicine' }), 0);

      const other = await signUp();
      await other.agent.post(`/api/parents/${parentId}/medicines/${id}/stop`).expect(404);
    });

    it('checks the schedule', async () => {
      const { customer, parentId } = await createFamily();
      const refused = (overrides) => addMedicine(customer.agent, parentId, overrides).expect(400);

      await refused({ times: [] });
      await refused({ times: ['08:00', '08:00'] });
      await refused({ times: ['25:00'] });
      await refused({ startDate: '2026-02-01', endDate: '2026-01-01' });
    });

    it('keeps medicines inside the family', async () => {
      const { parentId } = await createFamily();
      const other = await signUp();
      await other.agent.get(`/api/parents/${parentId}/medicines`).expect(404);
      await addMedicine(other.agent, parentId).expect(404);
    });

    it('refuses a dose that is not due, and keeps the first answer for a dose', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      const { medicine } = (await addMedicine(customer.agent, parentId)).body;
      const dose = (time, status) => ({ medicines: [{ medicineId: medicine.id, time, status }] });

      await logCall(caregiver, parentId, dose('11:11', 'given')).expect(400);
      await logCall(caregiver, parentId, dose('08:00', 'given')).expect(201);
      await logCall(caregiver, parentId, dose('08:00', 'missed')).expect(201);

      const res = await customer.agent.get(`/api/parents/${parentId}/medicines`);
      assert.equal(res.body.medicines[0].todayDoses[0].status, 'given');
      assert.equal(await Alert.countDocuments({ type: 'missed_medicine' }), 0);
    });

    it('reminds the caregiver once when a dose is near', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      await addMedicine(customer.agent, parentId, { times: ['09:10'] }).expect(201);
      const now = addIstMinutes(istDate(), '09:00', 0);

      await sendMedicineReminders(now);
      await sendMedicineReminders(now);

      const notes = await Notification.find({ userId: caregiver.user.id, title: /Medicine due/ });
      assert.equal(notes.length, 1);
    });

    it('does not remind about a dose that is hours away', async () => {
      const { customer, parentId } = await createFamily();
      await addMedicine(customer.agent, parentId, { times: ['18:00'] }).expect(201);

      await sendMedicineReminders(addIstMinutes(istDate(), '09:00', 0));
      assert.equal(await Notification.countDocuments({ title: /Medicine due/ }), 0);
    });
  });

  describe('FR-22 SOS', () => {
    it('lets the family and caregiver raise an SOS', async () => {
      const { customer, caregiver, parentId } = await createFamily();

      const first = await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      assert.equal(first.body.alert.severity, 'critical');
      assert.equal(first.body.alert.status, 'open');

      const repeat = await caregiver.agent.post('/api/alerts/sos').send({ parentId }).expect(200);
      assert.equal(repeat.body.created, false);
      assert.equal(await Alert.countDocuments({ type: 'sos' }), 1);
    });

    it('allows a new SOS once the last one is resolved', async () => {
      const { customer, parentId } = await createFamily();
      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      await Alert.updateOne({}, { status: 'resolved' });
      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
    });

    it('stops anyone outside the family raising one', async () => {
      const { parentId } = await createFamily();
      const other = await signUp();
      const stranger = await signUp('caregiver');

      await other.agent.post('/api/alerts/sos').send({ parentId }).expect(404);
      await stranger.agent.post('/api/alerts/sos').send({ parentId }).expect(404);
      await request(app).post('/api/alerts/sos').send({ parentId }).expect(401);
    });

    it('works from the parent page with no login, using the secret link', async () => {
      const { customer, parentId } = await createFamily();
      const { token } = (await customer.agent.get(`/api/parents/${parentId}/sos-link`)).body;

      const page = await request(app).get(`/api/alerts/public/${token}`).expect(200);
      assert.deepEqual(page.body, { name: 'Lakshmi' });

      await request(app).post(`/api/alerts/public/${token}/sos`).expect(201);
      await request(app).post(`/api/alerts/public/${token}/sos`).expect(200);

      const alert = await Alert.findOne({ type: 'sos' });
      assert.equal(alert.raisedVia, 'parent');
      assert.equal(await Alert.countDocuments({ type: 'sos' }), 1);
    });

    it('keeps the same link, kills the old one on reset, and hides it from others', async () => {
      const { customer, parentId } = await createFamily();
      const url = `/api/parents/${parentId}/sos-link`;

      const first = (await customer.agent.get(url)).body.token;
      assert.equal((await customer.agent.get(url)).body.token, first);

      const second = (await customer.agent.post(url).expect(200)).body.token;
      assert.notEqual(second, first);
      await request(app).get(`/api/alerts/public/${first}`).expect(404);
      await request(app).post(`/api/alerts/public/${first}/sos`).expect(404);

      const other = await signUp();
      await other.agent.get(url).expect(404);
    });
  });

  describe('FR-23 automatic alerts', () => {
    it('raises an alert for abnormal vitals only', async () => {
      const { caregiver, parentId } = await createFamily();

      await logCall(caregiver, parentId, { vitals: { bpSystolic: 130, pulse: 80 } }).expect(201);
      assert.equal(await Alert.countDocuments(), 0);

      const res = await logCall(caregiver, parentId, {
        vitals: { bpSystolic: 190, sugar: 300 },
      }).expect(201);

      const alert = await Alert.findOne({ type: 'abnormal_vitals' });
      assert.match(alert.message, /Systolic BP 190/);
      assert.match(alert.message, /Blood sugar 300/);
      assert.equal(alert.severity, 'high');
      assert.equal(res.body.abnormalVitals.length, 2);
    });

    it('flags vitals at the limits', () => {
      assert.equal(findAbnormalVitals({ temperature: 101 }).length, 1);
      assert.equal(findAbnormalVitals({ temperature: 100.9 }).length, 0);
      assert.equal(findAbnormalVitals({ pulse: 45 }).length, 1);
      assert.equal(findAbnormalVitals({}).length, 0);
    });

    it('raises an alert when a caregiver marks a dose missed', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      const { medicine } = (await addMedicine(customer.agent, parentId)).body;

      await logCall(caregiver, parentId, {
        medicines: [{ medicineId: medicine.id, time: '08:00', status: 'missed' }],
      }).expect(201);

      const alert = await Alert.findOne({ type: 'missed_medicine' });
      assert.match(alert.message, /Metformin at 08:00/);
      assert.equal(alert.raisedVia, 'caregiver');
    });

    it('notices doses nobody logged, once, after the grace period', async () => {
      const { customer, parentId } = await createFamily();
      await addMedicine(customer.agent, parentId, { times: ['08:00'] }).expect(201);

      await flagMissedMedicines(addIstMinutes(istDate(), '11:00', 0));
      assert.equal(await Alert.countDocuments(), 0);

      const late = addIstMinutes(istDate(), '12:30', 0);
      await flagMissedMedicines(late);
      await flagMissedMedicines(late);
      assert.equal(await Alert.countDocuments({ type: 'missed_medicine' }), 1);
    });

    it('does not double-alert when the job follows a caregiver marking a dose missed', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      const { medicine } = (await addMedicine(customer.agent, parentId)).body;
      await logCall(caregiver, parentId, {
        medicines: [{ medicineId: medicine.id, time: '08:00', status: 'missed' }],
      }).expect(201);

      await flagMissedMedicines(addIstMinutes(istDate(), '23:00', 0));
      const doses = await Alert.find({ type: 'missed_medicine', message: /08:00/ });
      assert.equal(doses.length, 1);
    });

    it('skips dose tracking on plans without daily check-ins', async () => {
      const { customer, parentId } = await createFamily({ planName: 'Basic' });
      await addMedicine(customer.agent, parentId).expect(201);

      await flagMissedMedicines(addIstMinutes(istDate(), '23:00', 0));
      assert.equal(await Alert.countDocuments(), 0);
    });

    it('flags a day with no check-in, once, after the evening cutoff', async () => {
      await createFamily();

      await flagMissedCheckIns(addIstMinutes(istDate(), '19:00', 0));
      assert.equal(await Alert.countDocuments(), 0);

      const evening = addIstMinutes(istDate(), '20:30', 0);
      await flagMissedCheckIns(evening);
      await flagMissedCheckIns(evening);
      assert.equal(await Alert.countDocuments({ type: 'missed_checkin' }), 1);
    });

    it('stays quiet when the check-in happened', async () => {
      const { caregiver, parentId } = await createFamily();
      await logCall(caregiver, parentId).expect(201);

      await flagMissedCheckIns(new Date(Date.parse(`${istDate()}T20:30:00+05:30`)));
      assert.equal(await Alert.countDocuments({ type: 'missed_checkin' }), 0);
    });

    it('gives a brand new caregiver until tomorrow', async () => {
      await createFamily();
      await Assignment.updateMany({}, { respondedAt: addIstMinutes(istDate(), '10:00', 0) });

      await flagMissedCheckIns(addIstMinutes(istDate(), '20:30', 0));
      assert.equal(await Alert.countDocuments(), 0);
    });

    it('allows weekly plans a week between check-ins', async () => {
      await createFamily({ planName: 'Basic' });
      await Assignment.updateMany({}, { respondedAt: new Date(Date.now() - 30 * 86_400_000) });
      const { caregiverId, parentId } = await Assignment.findOne();
      const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000);
      const checkIn = {
        parentId,
        caregiverId,
        type: 'call',
        mood: 'good',
        time: fourDaysAgo,
        date: istDate(fourDaysAgo),
      };
      await CheckIn.create(checkIn);

      await flagMissedCheckIns(addIstMinutes(istDate(), '20:30', 0));
      assert.equal(await Alert.countDocuments(), 0);

      await CheckIn.updateMany({}, { time: new Date(Date.now() - 9 * 86_400_000) });
      await flagMissedCheckIns(addIstMinutes(istDate(), '20:30', 0));
      assert.equal(await Alert.countDocuments({ type: 'missed_checkin' }), 1);
    });

    it('notifies the family and care manager', async () => {
      const { customer, manager, parentId } = await createFamily();
      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);

      const family = await customer.agent.get('/api/notifications').expect(200);
      const staff = await manager.agent.get('/api/notifications').expect(200);
      assert.equal(family.body.notifications[0].title, 'SOS emergency');
      assert.equal(staff.body.notifications[0].link, '/care-manager/alerts');
    });
  });

  describe('FR-24 handling alerts', () => {
    async function raiseSos() {
      const family = await createFamily();
      const res = await family.customer.agent
        .post('/api/alerts/sos')
        .send({ parentId: family.parentId })
        .expect(201);
      return { ...family, url: `/api/alerts/${res.body.alert.id}` };
    }

    it('moves from open to acknowledged to resolved, with history', async () => {
      const { manager, url } = await raiseSos();

      await manager.agent.patch(url).send({ action: 'resolve', note: 'Too early' }).expect(409);
      await manager.agent.patch(url).send({ action: 'acknowledge' }).expect(200);
      await manager.agent.patch(url).send({ action: 'resolve' }).expect(400);

      const res = await manager.agent
        .patch(url)
        .send({ action: 'resolve', note: 'Doctor visited, all fine' })
        .expect(200);

      assert.equal(res.body.alert.status, 'resolved');
      assert.deepEqual(
        res.body.alert.history.map(({ status }) => status),
        ['open', 'acknowledged', 'resolved'],
      );
      assert.equal(res.body.alert.history[2].note, 'Doctor visited, all fine');
    });

    it('stops other people acting on an alert', async () => {
      const { customer, caregiver, url } = await raiseSos();
      const otherManager = await signUp('careManager');

      await customer.agent.patch(url).send({ action: 'acknowledge' }).expect(403);
      await caregiver.agent.patch(url).send({ action: 'acknowledge' }).expect(403);
      await otherManager.agent.patch(url).send({ action: 'acknowledge' }).expect(409);
    });

    it('shows each person only their alerts, and contact details only to staff', async () => {
      const { customer, manager, parentId } = await raiseSos();
      const other = await signUp();
      const list = (agent) => agent.get('/api/alerts').expect(200);

      const family = (await list(customer.agent)).body.alerts;
      const staff = (await list(manager.agent)).body.alerts;

      assert.equal(family[0].parent.id, parentId);
      assert.equal(family[0].parent.name, 'Lakshmi Das');
      assert.equal(family[0].contact, undefined);
      assert.equal(staff[0].contact.emergencyContact.phone, '9876511111');
      assert.equal((await list(other.agent)).body.alerts.length, 0);
    });

    it('escalates an unanswered SOS to admin after 5 minutes, once', async () => {
      await raiseSos();
      const admin = await signUp('admin');
      const created = (await Alert.findOne()).createdAt.getTime();

      await escalateUnansweredSos(new Date(created + 4 * 60 * 1000));
      assert.equal((await admin.agent.get('/api/alerts')).body.alerts.length, 0);

      const late = new Date(created + 5 * 60 * 1000 + 1000);
      await escalateUnansweredSos(late);
      await escalateUnansweredSos(late);

      const { alerts } = (await admin.agent.get('/api/alerts')).body;
      assert.equal(alerts[0].escalated, true);
      assert.equal(await Notification.countDocuments({ userId: admin.user.id }), 1);
    });

    it('does not escalate an acknowledged SOS', async () => {
      const { manager, url } = await raiseSos();
      await manager.agent.patch(url).send({ action: 'acknowledge' }).expect(200);

      await escalateUnansweredSos(new Date(Date.now() + 10 * 60 * 1000));
      assert.equal((await Alert.findOne()).escalatedAt, undefined);
    });

    it('only escalates SOS alerts', async () => {
      const { caregiver, parentId } = await createFamily();
      await logCall(caregiver, parentId, { vitals: { pulse: 150 } }).expect(201);

      await escalateUnansweredSos(new Date(Date.now() + HOUR));
      assert.equal((await Alert.findOne()).escalatedAt, undefined);
    });

    it('goes straight to admin when there is no care manager', async () => {
      const { customer, parentId } = await createFamily({ careManager: false });
      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      assert.ok((await Alert.findOne()).escalatedAt);
    });

    it('lets admin handle an escalated alert', async () => {
      const { url } = await raiseSos();
      const admin = await signUp('admin');
      await admin.agent.patch(url).send({ action: 'acknowledge' }).expect(200);
    });
  });

  describe('notifications', () => {
    it('counts unread, marks them read, and stays private', async () => {
      const { customer, caregiver, parentId } = await createFamily();
      await logCall(caregiver, parentId).expect(201);

      const unread = await customer.agent.get('/api/notifications').expect(200);
      assert.equal(unread.body.unread, 1);

      await customer.agent.post('/api/notifications/read-all').expect(204);
      const read = await customer.agent.get('/api/notifications');
      assert.equal(read.body.unread, 0);

      const other = await signUp();
      assert.equal((await other.agent.get('/api/notifications')).body.notifications.length, 0);
    });

    it('warns a family a day before their trial ends, once', async () => {
      const customer = await signUp();
      const { id } = (await customer.agent.post('/api/parents').send({ name: 'Gopal' })).body.parent;
      await Subscription.create({
        customerId: customer.user.id,
        parentId: id,
        planId: (await Plan.findOne()).id,
        billingCycle: 'monthly',
        currency: 'INR',
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 12 * HOUR),
        renewsAt: new Date(Date.now() + 12 * HOUR),
      });

      await remindTrialEnding();
      await remindTrialEnding();
      assert.equal(await Notification.countDocuments({ title: /trial ends/ }), 1);
    });
  });

  describe('NFR-2 and NFR-5 live events', () => {
    const start = async (person) => (await person.agent.get('/api/live').expect(200)).body.now;

    const eventsSince = async (person, after) => {
      const res = await person.agent.get('/api/live').query({ after }).expect(200);
      return res.body.events;
    };

    const find = (events, name) => events.find(({ event }) => event === name);

    it('refuses polling without a valid session', async () => {
      await request(app).get('/api/live').expect(401);
      await request(app).get('/api/live').set('Cookie', 'homex_session=forged').expect(401);
    });

    it('never lets a browser store the reply', async () => {
      const { customer } = await createFamily();
      const res = await customer.agent.get('/api/live').expect(200);
      assert.equal(res.headers['cache-control'], 'no-store');
    });

    it('holds an SOS for the family and care manager as soon as it is raised', async () => {
      const { customer, manager, parentId } = await createFamily();
      const after = await start(customer);

      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);

      const atFamily = find(await eventsSince(customer, after), 'alert:new');
      const atManager = find(await eventsSince(manager, after), 'alert:new');

      assert.equal(atFamily.payload.type, 'sos');
      assert.equal(atManager.payload.parent.name, 'Lakshmi Das');
    });

    it('never delivers an alert to another family', async () => {
      const { customer, parentId } = await createFamily();
      const other = await signUp();
      const after = await start(other);

      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);

      assert.deepEqual(await eventsSince(other, after), []);
    });

    it('ignores any attempt to read someone else', async () => {
      const { customer, parentId } = await createFamily();
      const other = await signUp();
      const after = await start(other);

      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);

      const res = await other.agent
        .get('/api/live')
        .query({ after, userId: customer.user.id })
        .expect(200);
      assert.deepEqual(res.body.events, []);
    });

    it('refuses a date it cannot read', async () => {
      const { customer } = await createFamily();
      await customer.agent.get('/api/live').query({ after: 'yesterday-ish' }).expect(400);
    });

    it('sends alert:updated and checkin:new', async () => {
      const { customer, caregiver, manager, parentId } = await createFamily();
      const after = await start(customer);

      await logCall(caregiver, parentId).expect(201);
      const raised = await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      await manager.agent
        .patch(`/api/alerts/${raised.body.alert.id}`)
        .send({ action: 'acknowledge' })
        .expect(200);

      const events = await eventsSince(customer, after);
      assert.equal(find(events, 'checkin:new').payload.parent.id, parentId);
      assert.equal(find(events, 'alert:updated').payload.status, 'acknowledged');
    });

    it('tells admins when an SOS escalates', async () => {
      const { customer, parentId } = await createFamily();
      const admin = await signUp('admin');
      const after = await start(admin);

      await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      await escalateUnansweredSos(new Date(Date.now() + 6 * 60 * 1000));

      assert.equal(find(await eventsSince(admin, after), 'alert:new').payload.escalated, true);
    });

    it('stops delivering on logout', async () => {
      const { agent, cookie } = await signUp();
      await agent.get('/api/live').expect(200);

      await agent.post('/api/auth/logout').expect(204);

      await request(app).get('/api/live').set('Cookie', cookie).expect(401);
    });

    it('lets the database clear events after an hour', async () => {
      await LiveEvent.init();
      const indexes = await LiveEvent.collection.indexes();
      const ttl = indexes.find(({ key }) => key.createdAt === 1 && !key.userId);
      assert.equal(ttl.expireAfterSeconds, 3600);
    });
  });

  describe('scheduled work without a running server', () => {
    const SOON = 60 * 1000;

    async function overdueSos() {
      const { customer, parentId } = await createFamily();
      const raised = await customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      const { id } = raised.body.alert;
      await Alert.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { createdAt: new Date(Date.now() - 6 * 60 * 1000) } },
      );
      return id;
    }

    beforeEach(async () => {
      await JobRun.deleteMany({});
    });

    it('escalates an overdue SOS from any page poll', async () => {
      const id = await overdueSos();

      await runDueJobs(new Date(Date.now() + SOON));

      assert.ok((await Alert.findById(id)).escalatedAt);
    });

    it('checks the schedule at most every 15 seconds on one server', async () => {
      const base = Date.now() + 10 * SOON;
      await runDueJobs(new Date(base));
      await JobRun.deleteMany({});

      await runDueJobs(new Date(base + 5000));
      assert.equal(await JobRun.countDocuments(), 0);

      await runDueJobs(new Date(base + 16_000));
      assert.equal(await JobRun.countDocuments(), 4);
    });

    it('lets only one server run each job', async () => {
      const now = new Date();
      await Promise.all([runAllDueJobs(now), runAllDueJobs(now), runAllDueJobs(now)]);

      const runs = await JobRun.find({});
      assert.equal(runs.length, 4);

      const before = runs.find(({ _id }) => _id === 'sos').nextRunAt;
      await runAllDueJobs(new Date(now.getTime() + 1000));
      const after = await JobRun.findById('sos');
      assert.deepEqual(after.nextRunAt, before);
    });

    it('runs the job again once its time comes', async () => {
      const now = new Date();
      await runAllDueJobs(now);
      await runAllDueJobs(new Date(now.getTime() + 31_000));

      const sos = await JobRun.findById('sos');
      const care = await JobRun.findById('care');
      assert.equal(sos.nextRunAt.getTime(), now.getTime() + 61_000);
      assert.equal(care.nextRunAt.getTime(), now.getTime() + 15 * SOON);
    });

    it('keeps running the others when one task fails', async () => {
      const id = await overdueSos();
      const original = Plan.find;
      Plan.find = () => {
        throw new Error('database hiccup');
      };

      try {
        await runAllDueJobs();
      } finally {
        Plan.find = original;
      }

      assert.ok((await Alert.findById(id)).escalatedAt);
    });

    it('accepts the daily Vercel call only with its secret', async () => {
      const id = await overdueSos();

      await request(app).get('/api/jobs/tick').expect(401);
      await request(app).get('/api/jobs/tick').set('Authorization', 'Bearer wrong').expect(401);
      assert.equal((await Alert.findById(id)).escalatedAt, undefined);

      await request(app)
        .get('/api/jobs/tick')
        .set('Authorization', 'Bearer test-cron-secret')
        .expect(200);
      assert.ok((await Alert.findById(id)).escalatedAt);
    });
  });

  describe('India time', () => {
    it('rolls the care day at midnight in India, not UTC', () => {
      assert.equal(istDate(new Date('2026-11-01T18:29:00Z')), '2026-11-01');
      assert.equal(istDate(new Date('2026-11-01T18:31:00Z')), '2026-11-02');
      assert.equal(istTime(new Date('2026-11-01T02:30:00Z')), '08:00');
      assert.equal(addIstMinutes('2026-11-01', '08:00', 0).toISOString(), '2026-11-01T02:30:00.000Z');
    });
  });
});
