import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://unused/homex';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

// Imported after the variables above, because env.js reads them on load.
const { app } = await import('../app.js');
const { Alert } = await import('../models/Alert.js');
const { Assignment } = await import('../models/Assignment.js');
const { Booking } = await import('../models/Booking.js');
const { CaregiverProfile } = await import('../models/CaregiverProfile.js');
const { CareReport } = await import('../models/CareReport.js');
const { CheckIn } = await import('../models/CheckIn.js');
const { Complaint } = await import('../models/Complaint.js');
const { ConsentLog } = await import('../models/ConsentLog.js');
const { Medicine } = await import('../models/Medicine.js');
const { Notification } = await import('../models/Notification.js');
const { Parent } = await import('../models/Parent.js');
const { Payment } = await import('../models/Payment.js');
const { Plan } = await import('../models/Plan.js');
const { Review } = await import('../models/Review.js');
const { Subscription } = await import('../models/Subscription.js');
const { StoredFile } = await import('../models/StoredFile.js');
const { User } = await import('../models/User.js');
const { WellnessReport } = await import('../models/WellnessReport.js');
const { ensurePlans } = await import('../utils/ensurePlans.js');

const HOME = { lat: 20.288, lng: 85.844 };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from('%PDF-1.4 test');
const PASSWORD = 'correct-horse';
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
      password: PASSWORD,
      role: role === 'caregiver' ? 'caregiver' : 'customer',
      consent: true,
    })
    .expect(201);

  if (role === 'admin' || role === 'careManager') {
    await User.updateOne({ _id: res.body.user.id }, { role });
  }
  return { agent, user: res.body.user };
}

async function addCaregiver(name = 'Sunita Behera') {
  const caregiver = await signUp('caregiver', name);
  await CaregiverProfile.create({
    userId: caregiver.user.id,
    services: ['doctor_visit', 'lab_test', 'companionship'],
    languages: ['Odia'],
    location: { type: 'Point', coordinates: [HOME.lng, HOME.lat] },
    serviceRadiusKm: 10,
    availability: EVERY_DAY,
    verificationStatus: 'approved',
  });
  return caregiver;
}

async function createFamily({ plan = 'Standard' } = {}) {
  const manager = await signUp('careManager', 'Anjali Mishra');
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
      emergencyContact: { name: 'Son', phone: '9876511111' },
    })
    .expect(201);
  const parentId = created.body.parent.id;

  await Parent.updateOne(
    { _id: parentId },
    { careManagerId: manager.user.id, primaryCaregiverId: caregiver.user.id },
  );
  await Subscription.create({
    customerId: customer.user.id,
    parentId,
    planId: (await Plan.findOne({ name: plan })).id,
    billingCycle: 'monthly',
    currency: 'INR',
    status: 'active',
    renewsAt: new Date(Date.now() + 30 * 86_400_000),
  });
  return { manager, customer, caregiver, parentId };
}

const inHours = (hours) => new Date(Date.now() + hours * 3_600_000).toISOString();

const book = (family, serviceType = 'doctor_escort') =>
  family.customer.agent.post('/api/bookings').send({
    parentId: family.parentId,
    caregiverId: family.caregiver.user.id,
    serviceType,
    currency: 'INR',
    scheduledAt: inHours(24),
  });

describe('care manager, admin and account data', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, Plan, Parent, Subscription, CaregiverProfile, Complaint].map((m) => m.init()));
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
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
        Complaint,
        ConsentLog,
        Medicine,
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

  describe('FR-29 care manager', () => {
    it('lists only their own families, with what needs attention', async () => {
      const family = await createFamily();
      const other = await signUp('careManager');
      await family.customer.agent
        .post('/api/alerts/sos')
        .send({ parentId: family.parentId })
        .expect(201);
      await family.caregiver.agent
        .post('/api/checkins')
        .field('data', JSON.stringify({ parentId: family.parentId, type: 'call', mood: 'good' }))
        .expect(201);

      const res = await family.manager.agent.get('/api/caremanager/families').expect(200);
      const [entry] = res.body.families;
      assert.equal(entry.name, 'Ravi Das');
      assert.equal(entry.parents[0].planName, 'Standard');
      assert.equal(entry.parents[0].activeAlerts, 1);
      assert.equal(entry.parents[0].primaryCaregiver.name, 'Sunita Behera');
      assert.ok(entry.parents[0].latestCheckIn);

      const empty = await other.agent.get('/api/caremanager/families').expect(200);
      assert.equal(empty.body.families.length, 0);
    });

    it('opens a parent in full, for their own care manager only', async () => {
      const family = await createFamily();
      const other = await signUp('careManager');
      const url = `/api/caremanager/parents/${family.parentId}`;

      const res = await family.manager.agent.get(url).expect(200);
      assert.deepEqual(res.body.parent.conditions, ['Diabetes']);
      assert.equal(res.body.parent.family.phone, '9876543210');

      await other.agent.get(url).expect(404);
      await family.customer.agent.get(url).expect(403);
      await family.manager.agent.get(`/api/parents/${family.parentId}/checkins`).expect(200);
      await other.agent.get(`/api/parents/${family.parentId}/checkins`).expect(404);
    });

    it('can search for caregivers near a parent', async () => {
      const family = await createFamily();
      const res = await family.manager.agent
        .get('/api/caregivers/nearby')
        .query({ ...HOME, radius: 10 })
        .expect(200);
      assert.equal(res.body.caregivers.length, 1);
    });

    it('reassigns a primary caregiver at once, and tells everyone', async () => {
      const family = await createFamily();
      const next = await addCaregiver('Ramesh Rout');

      await family.manager.agent
        .post(`/api/parents/${family.parentId}/assign`)
        .send({ caregiverId: next.user.id, type: 'primary' })
        .expect(201);

      const parent = await Parent.findById(family.parentId);
      assert.equal(String(parent.primaryCaregiverId), next.user.id);

      const titles = async ({ user }) =>
        (await Notification.find({ userId: user.id })).map(({ title }) => title);
      assert.ok((await titles(next)).includes('New family'));
      assert.ok((await titles(family.caregiver)).includes('Family reassigned'));
      assert.ok((await titles(family.customer)).includes('Caregiver changed'));
    });

    it('refuses the same person twice', async () => {
      const family = await createFamily();
      const url = `/api/parents/${family.parentId}/assign`;
      const { id } = family.caregiver.user;

      await family.manager.agent.post(url).send({ caregiverId: id, type: 'primary' }).expect(409);
      await family.manager.agent.post(url).send({ caregiverId: id, type: 'backup' }).expect(409);
    });
  });

  describe('FR-32 admin', () => {
    it('reports platform totals', async () => {
      const family = await createFamily();
      const admin = await signUp('admin');
      await book(family).expect(201);
      await family.customer.agent
        .post('/api/alerts/sos')
        .send({ parentId: family.parentId })
        .expect(201);

      const { stats } = (await admin.agent.get('/api/admin/stats').expect(200)).body;
      assert.equal(stats.families, 1);
      assert.equal(stats.parents, 1);
      assert.equal(stats.activePlans, 1);
      assert.equal(stats.caregivers, 1);
      assert.equal(stats.careManagers, 1);
      assert.equal(stats.openAlerts, 1);
      assert.equal(stats.bookings.find(({ status }) => status === 'REQUESTED').count, 1);
    });

    it('is closed to everyone else', async () => {
      const family = await createFamily();
      for (const path of ['stats', 'users', 'care-managers', 'bookings', 'complaints']) {
        await family.manager.agent.get(`/api/admin/${path}`).expect(403);
        await family.customer.agent.get(`/api/admin/${path}`).expect(403);
        await request(app).get(`/api/admin/${path}`).expect(401);
      }
    });

    it('filters and searches users, treating search text literally', async () => {
      await signUp('customer', 'Ananya Das');
      await signUp('caregiver', 'Sunita Behera');
      const admin = await signUp('admin');

      const names = async (query) =>
        (await admin.agent.get('/api/admin/users').query(query).expect(200)).body.users.map(
          ({ name }) => name,
        );

      assert.deepEqual(await names({ role: 'caregiver' }), ['Sunita Behera']);
      assert.deepEqual(await names({ q: 'ananya' }), ['Ananya Das']);
      assert.deepEqual(await names({ q: '.*' }), []);
    });

    it('deactivates a user, ending their session', async () => {
      const person = await signUp();
      const admin = await signUp('admin');
      await person.agent.get('/api/auth/me').expect(200);

      await admin.agent
        .patch(`/api/admin/users/${person.user.id}`)
        .send({ isActive: false })
        .expect(200);
      await person.agent.get('/api/auth/me').expect(401);

      await admin.agent
        .patch(`/api/admin/users/${person.user.id}`)
        .send({ isActive: true })
        .expect(200);
      await person.agent.get('/api/auth/me').expect(200);
    });

    it('stops an admin deactivating themselves', async () => {
      const admin = await signUp('admin');
      await admin.agent
        .patch(`/api/admin/users/${admin.user.id}`)
        .send({ isActive: false })
        .expect(409);
    });

    it('creates care managers who can log in, refusing duplicates', async () => {
      const admin = await signUp('admin');
      const body = {
        name: 'Anjali Mishra',
        email: 'anjali@homex.test',
        phone: '9876500000',
        password: 'a-long-password',
      };

      const res = await admin.agent.post('/api/admin/care-managers').send(body).expect(201);
      assert.equal(res.body.careManager.role, 'careManager');
      await admin.agent.post('/api/admin/care-managers').send(body).expect(409);
      await admin.agent
        .post('/api/admin/care-managers')
        .send({ ...body, email: 'x@homex.test', password: 'short' })
        .expect(400);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: body.email, password: body.password })
        .expect(200);
      assert.equal(login.body.user.role, 'careManager');
    });

    it('moves families to another manager when one is deactivated', async () => {
      const family = await createFamily();
      const next = await signUp('careManager', 'Second Manager');
      const admin = await signUp('admin');
      await family.customer.agent
        .post('/api/alerts/sos')
        .send({ parentId: family.parentId })
        .expect(201);

      await admin.agent
        .patch(`/api/admin/users/${family.manager.user.id}`)
        .send({ isActive: false })
        .expect(200);

      assert.equal(String((await Parent.findById(family.parentId)).careManagerId), next.user.id);
      assert.equal(String((await Alert.findOne()).careManagerId), next.user.id);

      const list = await admin.agent.get('/api/admin/care-managers').expect(200);
      assert.equal(list.body.careManagers.find(({ id }) => id === next.user.id).families, 1);
    });

    it('clears the manager when nobody is left, so an SOS goes straight to admin', async () => {
      const family = await createFamily();
      const admin = await signUp('admin');

      await admin.agent
        .patch(`/api/admin/users/${family.manager.user.id}`)
        .send({ isActive: false })
        .expect(200);

      assert.equal((await Parent.findById(family.parentId)).careManagerId, undefined);
      await family.customer.agent
        .post('/api/alerts/sos')
        .send({ parentId: family.parentId })
        .expect(201);
      assert.ok((await Alert.findOne()).escalatedAt);
    });

    it('warns the care manager when a caregiver is deactivated', async () => {
      const family = await createFamily();
      const admin = await signUp('admin');

      await admin.agent
        .patch(`/api/admin/users/${family.caregiver.user.id}`)
        .send({ isActive: false })
        .expect(200);

      const note = await Notification.findOne({ userId: family.manager.user.id });
      assert.match(note.body, /Please reassign Lakshmi Das/);
    });

    it('lists all bookings, filtered by status', async () => {
      const family = await createFamily();
      const admin = await signUp('admin');
      await book(family).expect(201);

      const all = await admin.agent.get('/api/admin/bookings').expect(200);
      assert.equal(all.body.bookings[0].customerName, 'Ravi Das');

      const none = await admin.agent
        .get('/api/admin/bookings')
        .query({ status: 'COMPLETED' })
        .expect(200);
      assert.equal(none.body.bookings.length, 0);
      await admin.agent.get('/api/admin/bookings').query({ status: 'NOPE' }).expect(400);
    });
  });

  describe('complaints', () => {
    it('runs from raised to resolved, and tells both sides', async () => {
      const family = await createFamily();
      const admin = await signUp('admin');
      const { id } = (await book(family).expect(201)).body.booking;
      const body = { bookingId: id, message: 'The caregiver arrived very late.' };

      const raised = await family.customer.agent.post('/api/complaints').send(body).expect(201);
      await family.customer.agent.post('/api/complaints').send(body).expect(409);
      assert.equal(await Notification.countDocuments({ title: 'New complaint' }), 1);

      const open = await admin.agent.get('/api/admin/complaints').expect(200);
      assert.equal(open.body.complaints[0].customer.name, 'Ravi Das');
      assert.equal(open.body.complaints[0].booking.caregiverName, 'Sunita Behera');

      const url = `/api/admin/complaints/${raised.body.complaint.id}`;
      await admin.agent.patch(url).send({ resolution: 'x' }).expect(400);
      await admin.agent.patch(url).send({ resolution: 'We spoke to the caregiver.' }).expect(200);
      await admin.agent.patch(url).send({ resolution: 'Again, please.' }).expect(409);

      const list = await family.customer.agent.get('/api/bookings').expect(200);
      assert.equal(list.body.bookings[0].complaint.status, 'resolved');
      assert.equal(list.body.bookings[0].complaint.resolution, 'We spoke to the caregiver.');
    });

    it("cannot be raised on someone else's booking, or left empty", async () => {
      const family = await createFamily();
      const other = await signUp();
      const { id } = (await book(family).expect(201)).body.booking;

      await other.agent
        .post('/api/complaints')
        .send({ bookingId: id, message: 'This is not my booking.' })
        .expect(404);
      await family.customer.agent
        .post('/api/complaints')
        .send({ bookingId: id, message: 'x' })
        .expect(400);
    });
  });

  describe('FR-33 data download', () => {
    it("gives a family their records, with no internal secrets or other people's data", async () => {
      const family = await createFamily();
      await family.customer.agent.get(`/api/parents/${family.parentId}/sos-link`).expect(200);
      await family.caregiver.agent
        .post('/api/checkins')
        .field(
          'data',
          JSON.stringify({ parentId: family.parentId, type: 'visit', mood: 'good', location: HOME }),
        )
        .attach('photo', PNG, 'visit.png')
        .expect(201);
      const other = await createFamily();
      assert.ok(other.parentId);

      const res = await family.customer.agent.get('/api/me/data').expect(200);
      assert.match(res.headers['content-disposition'], /homex-my-data\.json/);

      const data = JSON.parse(res.text);
      assert.equal(data.account.email, family.customer.user.email);
      assert.equal(data.consent.length, 1);
      assert.equal(data.parents.length, 1);
      assert.equal(data.checkIns.length, 1);
      assert.equal(data.subscriptions.length, 1);

      assert.doesNotMatch(res.text, /passwordHash|tokenVersion|sosToken|"file"|\.png/);
    });

    it('needs a login', async () => {
      await request(app).get('/api/me/data').expect(401);
    });

    it('gives a caregiver their own records, without family contacts', async () => {
      const family = await createFamily();
      await book(family).expect(201);

      const res = await family.caregiver.agent.get('/api/me/data').expect(200);
      const data = JSON.parse(res.text);
      assert.equal(data.profile.verificationStatus, 'approved');
      assert.equal(data.bookings.length, 1);
      assert.equal(data.bookings[0].customerId, undefined);
    });
  });

  describe('FR-33 deleting an account', () => {
    const remove = (person, password = PASSWORD) =>
      person.agent.delete('/api/me/data').send({ password });

    it('needs the right password', async () => {
      const family = await createFamily();
      const res = await remove(family.customer, 'wrong-password').expect(400);
      assert.ok(res.body.error.fields.password);
      assert.ok(await User.findById(family.customer.user.id));
    });

    it('erases a family and their health records, and ends the session', async () => {
      const family = await createFamily();
      const stranger = await createFamily();
      const { parentId } = family;

      await family.caregiver.agent
        .post('/api/checkins')
        .field('data', JSON.stringify({ parentId, type: 'visit', mood: 'good', location: HOME }))
        .attach('photo', PNG, 'visit.png')
        .expect(201);
      await family.customer.agent
        .post(`/api/parents/${parentId}/medicines`)
        .send({ name: 'Metformin', dose: '500 mg', times: ['08:00'], startDate: '2026-01-01' })
        .expect(201);
      await family.customer.agent.post('/api/alerts/sos').send({ parentId }).expect(201);
      await stranger.customer.agent
        .post('/api/alerts/sos')
        .send({ parentId: stranger.parentId })
        .expect(201);

      const filesBefore = await StoredFile.countDocuments();
      assert.ok(filesBefore > 0);

      await remove(family.customer).expect(204);

      assert.equal(await User.exists({ _id: family.customer.user.id }), null);
      assert.equal(await Parent.exists({ _id: parentId }), null);
      for (const model of [CheckIn, Medicine, Alert, Subscription]) {
        assert.equal(await model.exists({ parentId }), null);
      }
      assert.equal(await StoredFile.countDocuments(), filesBefore - 1);
      await family.customer.agent.get('/api/auth/me').expect(401);

      assert.ok(await Parent.exists({ _id: stranger.parentId }));
      assert.equal(await Alert.countDocuments({ parentId: stranger.parentId }), 1);
    });

    it('keeps the proof of consent, marked as withdrawn', async () => {
      const family = await createFamily();
      await remove(family.customer).expect(204);

      const log = await ConsentLog.findOne({ userId: family.customer.user.id });
      assert.ok(log.withdrawnAt);
    });

    it('cancels open bookings and refunds them', async () => {
      const family = await createFamily({ plan: 'Basic' });
      const { id } = (await book(family).expect(201)).body.booking;

      await remove(family.customer).expect(204);

      const booking = await Booking.findById(id);
      assert.equal(booking.status, 'CANCELLED');
      assert.equal(booking.paymentStatus, 'refunded');
      assert.equal((await Payment.findOne()).status, 'refunded');
    });

    it('keeps caregiver earnings and payments, with nothing naming the family', async () => {
      const family = await createFamily({ plan: 'Basic' });
      const { id } = (await book(family).expect(201)).body.booking;
      const step = (action, extra = {}) =>
        family.caregiver.agent.patch(`/api/bookings/${id}/status`).send({ action, ...extra });
      await step('accept').expect(200);
      await step('fix_appointment', { note: 'Dr Mohanty at 11:30' }).expect(200);
      await step('start').expect(200);
      await step('complete').expect(200);
      await family.customer.agent
        .post('/api/reviews')
        .send({
          caregiverId: family.caregiver.user.id,
          bookingId: id,
          rating: 5,
          comment: 'Kind words from Ravi',
        })
        .expect(201);

      await remove(family.customer).expect(204);

      const earnings = await family.caregiver.agent.get('/api/caregivers/me/earnings').expect(200);
      assert.equal(earnings.body.totalInr, 559);
      assert.equal(earnings.body.items[0].parentName, 'Removed parent');

      const list = await family.caregiver.agent.get('/api/bookings').expect(200);
      assert.equal(list.body.bookings[0].family, null);
      assert.equal(list.body.bookings[0].statusHistory.length, 0);
      assert.doesNotMatch(JSON.stringify(list.body), /Ravi|Lakshmi/);

      assert.equal(await Payment.countDocuments(), 1);

      const profile = await family.caregiver.agent.get('/api/caregivers/me').expect(200);
      assert.equal(profile.body.profile.ratingCount, 1);
      const review = await Review.findOne();
      assert.equal(review.customerId, undefined);
      assert.equal(review.comment, undefined);
    });

    it('lets a caregiver leave once nobody depends on them', async () => {
      const family = await createFamily();

      const stillCaring = await remove(family.caregiver).expect(409);
      assert.match(stillCaring.body.error.message, /care manager/);

      await Parent.updateOne({ _id: family.parentId }, { $unset: { primaryCaregiverId: 1 } });
      await remove(family.caregiver).expect(204);

      assert.equal(await CaregiverProfile.exists({ userId: family.caregiver.user.id }), null);
      assert.equal(await User.exists({ _id: family.caregiver.user.id }), null);
    });

    it('stops a caregiver leaving during an open booking, and copes after they go', async () => {
      const family = await createFamily();
      await Parent.updateOne({ _id: family.parentId }, { $unset: { primaryCaregiverId: 1 } });
      const { id } = (await book(family, 'companionship').expect(201)).body.booking;

      await remove(family.caregiver).expect(409);

      await family.customer.agent
        .patch(`/api/bookings/${id}/status`)
        .send({ action: 'cancel' })
        .expect(200);
      await remove(family.caregiver).expect(204);

      const list = await family.customer.agent.get('/api/bookings').expect(200);
      assert.equal(list.body.bookings[0].caregiver.name, 'Former caregiver');
    });

    it('removes a caregiver document from disk', async () => {
      const caregiver = await signUp('caregiver');
      await caregiver.agent
        .post('/api/caregivers/me/documents')
        .field('type', 'id')
        .attach('file', PDF, 'id.pdf')
        .expect(201);
      const before = await StoredFile.countDocuments();

      await remove(caregiver).expect(204);
      assert.equal(await StoredFile.countDocuments(), before - 1);
    });

    it('does not let staff delete themselves', async () => {
      const admin = await signUp('admin');
      await remove(admin).expect(403);
      assert.ok(await User.findById(admin.user.id));
    });
  });
});
