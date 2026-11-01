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
const { Assignment } = await import('../models/Assignment.js');
const { CaregiverProfile } = await import('../models/CaregiverProfile.js');
const { Parent } = await import('../models/Parent.js');
const { Plan } = await import('../models/Plan.js');
const { Subscription } = await import('../models/Subscription.js');
const { StoredFile } = await import('../models/StoredFile.js');
const { User } = await import('../models/User.js');
const { ensurePlans } = await import('../utils/ensurePlans.js');

const SAHEED_NAGAR = { lat: 20.288, lng: 85.844 };
const PATIA = { lat: 20.3545, lng: 85.818 }; // About 8 km from Saheed Nagar
const PURI = { lat: 19.8135, lng: 85.8312 }; // About 53 km from Saheed Nagar

const PDF = Buffer.from('%PDF-1.4 test');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const PARENT = {
  name: 'Lakshmi Das',
  age: 72,
  address: '12 Saheed Nagar, Bhubaneswar',
  location: SAHEED_NAGAR,
  conditions: ['Diabetes'],
  allergies: ['Penicillin'],
  emergencyContact: { name: 'Ravi Das', phone: '98765 43210', relation: 'Son' },
};

const PROFILE = {
  bio: 'I have looked after elders in my neighbourhood for many years.',
  services: ['daily_checkin', 'doctor_visit'],
  experienceYears: 6,
  languages: ['Odia', 'Hindi'],
  certificates: ['First aid'],
  area: 'Patia',
  location: PATIA,
  serviceRadiusKm: 15,
  availability: [{ day: 'mon', start: '09:00', end: '17:00' }],
};

let accountCount = 0;

async function signUp(role = 'customer', name = `Person ${accountCount}`) {
  accountCount += 1;
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({
      name,
      email: `person${accountCount}@example.com`,
      phone: '9876543210',
      password: 'correct-horse',
      role: role === 'customer' ? 'customer' : 'caregiver',
      consent: true,
    })
    .expect(201);

  if (role === 'admin' || role === 'careManager') {
    await User.updateOne({ _id: res.body.user.id }, { role });
  }
  return { agent, user: res.body.user };
}

async function addSubmittedCaregiver(overrides = {}) {
  const caregiver = await signUp('caregiver', overrides.name ?? 'Sunita Behera');
  await caregiver.agent.put('/api/caregivers/me').send({ ...PROFILE, ...overrides.profile }).expect(200);

  for (const type of ['id', 'police', 'certificate']) {
    await caregiver.agent
      .post('/api/caregivers/me/documents')
      .field('type', type)
      .attach('file', PDF, 'proof.pdf')
      .expect(201);
  }
  await caregiver.agent.post('/api/caregivers/me/submit').expect(200);
  return caregiver;
}

async function addApprovedCaregiver(overrides) {
  const caregiver = await addSubmittedCaregiver(overrides);
  await CaregiverProfile.updateOne(
    { userId: caregiver.user.id },
    { verificationStatus: 'approved', policeVerified: true },
  );
  return caregiver;
}

async function addParentWithPlan(agent, customerId) {
  const res = await agent.post('/api/parents').send(PARENT).expect(201);
  const plan = await Plan.findOne({ name: 'Standard' });
  await Subscription.create({
    customerId,
    parentId: res.body.parent.id,
    planId: plan.id,
    billingCycle: 'monthly',
    currency: 'INR',
    status: 'trial',
    renewsAt: new Date(Date.now() + 86_400_000),
  });
  return res.body.parent;
}

const nearby = (agent, query) =>
  agent.get('/api/caregivers/nearby').query({ ...SAHEED_NAGAR, radius: 25, ...query });

describe('parents, caregivers and assignment', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all([User, CaregiverProfile, Assignment, Subscription, Plan].map((m) => m.init()));
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      [User, CaregiverProfile, Parent, Assignment, Subscription, Plan].map((m) => m.deleteMany({})),
    );
    await ensurePlans();
  });

  describe('FR-12 parent profiles', () => {
    it('adds, reads, edits and deletes a full profile', async () => {
      const { agent } = await signUp();
      const created = await agent.post('/api/parents').send(PARENT).expect(201);
      const { id } = created.body.parent;

      assert.equal(created.body.parent.profileComplete, true);
      assert.deepEqual(created.body.parent.location, SAHEED_NAGAR);
      assert.equal(created.body.parent.emergencyContact.phone, '9876543210');

      const read = await agent.get(`/api/parents/${id}`).expect(200);
      assert.deepEqual(read.body.parent.conditions, ['Diabetes']);

      const updated = await agent.put(`/api/parents/${id}`).send({ ...PARENT, age: 73 }).expect(200);
      assert.equal(updated.body.parent.age, 73);

      await agent.delete(`/api/parents/${id}`).expect(204);
      await agent.get(`/api/parents/${id}`).expect(404);
    });

    it('accepts a name alone at checkout, then requires a full profile to edit', async () => {
      const { agent } = await signUp();
      const res = await agent.post('/api/parents').send({ name: 'Gopal' }).expect(201);
      assert.equal(res.body.parent.profileComplete, false);

      const refused = await agent
        .put(`/api/parents/${res.body.parent.id}`)
        .send({ name: 'Gopal' })
        .expect(400);
      assert.ok(refused.body.error.fields.address);
      assert.ok(refused.body.error.fields.location);
    });

    it('returns clear errors for bad details', async () => {
      const { agent } = await signUp();
      const res = await agent
        .post('/api/parents')
        .send({
          ...PARENT,
          age: 12,
          emergencyContact: { name: 'R', phone: '12', relation: '' },
        })
        .expect(400);

      assert.ok(res.body.error.fields.age);
      assert.ok(res.body.error.fields['emergencyContact.name']);
      assert.ok(res.body.error.fields['emergencyContact.phone']);
    });

    it('NFR-3 hides a parent from every other customer', async () => {
      const { agent: owner } = await signUp();
      const created = await owner.post('/api/parents').send(PARENT).expect(201);
      const { agent: other } = await signUp();
      const { id } = created.body.parent;

      await other.get(`/api/parents/${id}`).expect(404);
      await other.put(`/api/parents/${id}`).send(PARENT).expect(404);
      await other.delete(`/api/parents/${id}`).expect(404);
      assert.equal((await other.get('/api/parents')).body.parents.length, 0);
    });

    it('is closed to caregivers', async () => {
      const { agent } = await signUp('caregiver');
      await agent.get('/api/parents').expect(403);
    });

    it('refuses to delete a parent with a running plan', async () => {
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      await agent.delete(`/api/parents/${parent.id}`).expect(409);
    });

    it('keeps billing working after a parent with a cancelled plan is removed', async () => {
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      await Subscription.updateOne({ parentId: parent.id }, { status: 'cancelled' });
      await agent.delete(`/api/parents/${parent.id}`).expect(204);

      const res = await agent.get('/api/subscriptions').expect(200);
      assert.equal(res.body.subscriptions[0].parent.name, 'Removed parent');
    });

    it('gives a family one care manager across its parents, least busy first', async () => {
      const busy = await signUp('careManager', 'Busy Manager');
      await signUp('careManager', 'Free Manager');
      await Parent.create({
        customerId: new mongoose.Types.ObjectId(),
        name: 'Another family',
        careManagerId: busy.user.id,
      });

      const { agent } = await signUp();
      const first = await agent.post('/api/parents').send({ name: 'Lakshmi' }).expect(201);
      const second = await agent.post('/api/parents').send({ name: 'Gopal' }).expect(201);

      assert.equal(first.body.parent.careManager.name, 'Free Manager');
      assert.equal(second.body.parent.careManager.id, first.body.parent.careManager.id);
    });
  });

  describe('FR-13 and FR-14 caregiver profiles', () => {
    it('saves a profile and reports what is missing', async () => {
      const { agent } = await signUp('caregiver');
      const empty = await agent.get('/api/caregivers/me').expect(200);
      assert.equal(empty.body.profile.verificationStatus, 'draft');
      assert.equal(empty.body.profile.missing.length, 8);

      const res = await agent.put('/api/caregivers/me').send(PROFILE).expect(200);
      assert.deepEqual(res.body.profile.location, PATIA);
      assert.deepEqual(res.body.profile.missing, [
        'An ID document',
        'Your police verification',
        'A training certificate',
      ]);
    });

    it('refuses bad availability', async () => {
      const { agent } = await signUp('caregiver');
      const body = (availability) => ({ availability });

      await agent
        .put('/api/caregivers/me')
        .send(body([{ day: 'mon', start: '17:00', end: '09:00' }]))
        .expect(400);
      await agent
        .put('/api/caregivers/me')
        .send(
          body([
            { day: 'mon', start: '09:00', end: '10:00' },
            { day: 'mon', start: '11:00', end: '12:00' },
          ]),
        )
        .expect(400);
    });

    it('stores real documents and refuses files that only claim to be one', async () => {
      const { agent } = await signUp('caregiver');
      const fake = Buffer.from('<script>alert(1)</script>');

      await agent
        .post('/api/caregivers/me/documents')
        .field('type', 'id')
        .attach('file', fake, { filename: 'id.pdf', contentType: 'application/pdf' })
        .expect(400);
      await agent
        .post('/api/caregivers/me/documents')
        .field('type', 'passport')
        .attach('file', PDF, 'id.pdf')
        .expect(400);

      const res = await agent
        .post('/api/caregivers/me/documents')
        .field('type', 'id')
        .attach('file', PDF, 'id.pdf')
        .expect(201);
      assert.equal(res.body.profile.documents[0].name, 'id.pdf');
      assert.equal(res.body.profile.documents[0].file, undefined);
    });

    it('refuses files over 4 MB', async () => {
      const { agent } = await signUp('caregiver');
      const res = await agent
        .post('/api/caregivers/me/documents')
        .field('type', 'id')
        .attach('file', Buffer.concat([PDF, Buffer.alloc(4 * 1024 * 1024)]), 'big.pdf')
        .expect(400);
      assert.match(res.body.error.message, /4 MB/);
    });

    it('removes the file when a document is deleted', async () => {
      const { agent } = await signUp('caregiver');
      const before = await StoredFile.countDocuments();
      const res = await agent
        .post('/api/caregivers/me/documents')
        .field('type', 'id')
        .attach('file', PDF, 'id.pdf')
        .expect(201);
      assert.equal(await StoredFile.countDocuments(), before + 1);

      await agent.delete(`/api/caregivers/me/documents/${res.body.profile.documents[0].id}`).expect(200);
      assert.equal(await StoredFile.countDocuments(), before);
    });

    it('lets only the owner and admin open a document', async () => {
      const caregiver = await signUp('caregiver');
      const res = await caregiver.agent
        .post('/api/caregivers/me/documents')
        .field('type', 'police')
        .attach('file', PDF, 'police.pdf')
        .expect(201);
      const url = `/api/caregivers/${caregiver.user.id}/documents/${res.body.profile.documents[0].id}`;

      const file = await caregiver.agent.get(url).expect(200);
      assert.equal(file.headers['content-type'], 'application/pdf');
      assert.equal(file.headers['cache-control'], 'private, no-store');

      const { agent: admin } = await signUp('admin');
      await admin.get(url).expect(200);

      const { agent: customer } = await signUp();
      await customer.get(url).expect(403);
      await request(app).get(url).expect(401);
    });

    it('requires everything before review', async () => {
      const { agent } = await signUp('caregiver');
      await agent.put('/api/caregivers/me').send(PROFILE).expect(200);
      const res = await agent.post('/api/caregivers/me/submit').expect(400);
      assert.match(res.body.error.message, /police verification/);
    });

    it('accepts a JPG or PNG photo and refuses a PDF', async () => {
      const { agent, user } = await signUp('caregiver');
      await agent.post('/api/caregivers/me/photo').attach('file', PDF, 'me.pdf').expect(400);
      await agent.post('/api/caregivers/me/photo').attach('file', PNG, 'me.png').expect(200);

      const photo = await agent.get(`/api/caregivers/${user.id}/photo`).expect(200);
      assert.equal(photo.headers['content-type'], 'image/png');
    });
  });

  describe('FR-15 admin verification', () => {
    it('queues submitted caregivers and approves them', async () => {
      const caregiver = await addSubmittedCaregiver();
      const { agent: admin } = await signUp('admin');

      const queue = await admin.get('/api/admin/caregivers').expect(200);
      assert.equal(queue.body.caregivers.length, 1);
      assert.equal(queue.body.caregivers[0].documentCount, 3);

      const detail = await admin.get(`/api/admin/caregivers/${caregiver.user.id}`).expect(200);
      assert.equal(detail.body.caregiver.documents.length, 3);

      await admin
        .patch(`/api/admin/caregivers/${caregiver.user.id}`)
        .send({ action: 'approve' })
        .expect(200);

      const profile = await caregiver.agent.get('/api/caregivers/me').expect(200);
      assert.equal(profile.body.profile.verificationStatus, 'approved');
      assert.equal(profile.body.profile.policeVerified, true);
      assert.equal((await User.findById(caregiver.user.id)).isVerified, true);
    });

    it('requires a reason to reject, and lets the caregiver fix and resubmit', async () => {
      const caregiver = await addSubmittedCaregiver();
      const { agent: admin } = await signUp('admin');
      const url = `/api/admin/caregivers/${caregiver.user.id}`;

      await admin.patch(url).send({ action: 'reject' }).expect(400);
      await admin.patch(url).send({ action: 'reject', reason: 'The ID photo is blurred' }).expect(200);

      const rejected = await caregiver.agent.get('/api/caregivers/me').expect(200);
      assert.equal(rejected.body.profile.verificationStatus, 'rejected');
      assert.equal(rejected.body.profile.rejectionReason, 'The ID photo is blurred');

      await caregiver.agent.post('/api/caregivers/me/submit').expect(200);
      const resubmitted = await caregiver.agent.get('/api/caregivers/me').expect(200);
      assert.equal(resubmitted.body.profile.verificationStatus, 'pending');
      assert.equal(resubmitted.body.profile.rejectionReason, null);
    });

    it('sends an approved caregiver back for review when documents change', async () => {
      const caregiver = await addApprovedCaregiver();
      const { agent: customer } = await signUp();
      assert.equal((await nearby(customer)).body.caregivers.length, 1);

      await caregiver.agent
        .post('/api/caregivers/me/documents')
        .field('type', 'certificate')
        .attach('file', PDF, 'new.pdf')
        .expect(201);

      assert.equal((await nearby(customer)).body.caregivers.length, 0);
    });

    it('is admin only', async () => {
      const { agent } = await signUp('careManager');
      await agent.get('/api/admin/caregivers').expect(403);
    });
  });

  describe('FR-16 finding caregivers', () => {
    it('shows approved caregivers only, nearest first', async () => {
      await addSubmittedCaregiver({ name: 'Waiting Review' });
      await addApprovedCaregiver({ name: 'Far Patia' });
      await addApprovedCaregiver({
        name: 'Near Unit',
        profile: { location: { lat: 20.273, lng: 85.838 } },
      });
      const { agent } = await signUp();

      const res = await nearby(agent).expect(200);
      assert.deepEqual(
        res.body.caregivers.map((caregiver) => caregiver.name),
        ['Near Unit', 'Far Patia'],
      );
      assert.ok(res.body.caregivers[0].distanceKm < res.body.caregivers[1].distanceKm);
    });

    it("respects both the family's radius and the caregiver's service area", async () => {
      await addApprovedCaregiver({ name: 'Short Reach', profile: { serviceRadiusKm: 2 } });
      await addApprovedCaregiver({ name: 'Long Reach', profile: { serviceRadiusKm: 30 } });
      await addApprovedCaregiver({ name: 'Too Far', profile: { location: PURI, serviceRadiusKm: 50 } });
      const { agent } = await signUp();

      const names = async (radius) =>
        (await nearby(agent, { radius })).body.caregivers.map((caregiver) => caregiver.name);

      assert.deepEqual(await names(25), ['Long Reach']);
      assert.deepEqual(await names(3), []);
    });

    it('filters by service, rating, day and language', async () => {
      const caregiver = await addApprovedCaregiver();
      await CaregiverProfile.updateOne({ userId: caregiver.user.id }, { ratingAvg: 4.5 });
      const { agent } = await signUp();
      const count = async (query) => (await nearby(agent, query)).body.caregivers.length;

      assert.equal(await count({ service: 'doctor_visit' }), 1);
      assert.equal(await count({ service: 'post_hospital' }), 0);
      assert.equal(await count({ minRating: 4 }), 1);
      assert.equal(await count({ minRating: 4.8 }), 0);
      assert.equal(await count({ day: 'mon' }), 1);
      assert.equal(await count({ day: 'sun' }), 0);
      assert.equal(await count({ language: 'Odia' }), 1);
      assert.equal(await count({ language: 'Tamil' }), 0);
    });

    it('leaves out deactivated caregivers', async () => {
      const caregiver = await addApprovedCaregiver();
      await User.updateOne({ _id: caregiver.user.id }, { isActive: false });
      const { agent } = await signUp();
      assert.equal((await nearby(agent)).body.caregivers.length, 0);
    });

    it('never exposes a phone number, documents or an exact location', async () => {
      await addApprovedCaregiver({ profile: { location: { lat: 20.35451234, lng: 85.81801234 } } });
      const { agent } = await signUp();
      const [caregiver] = (await nearby(agent)).body.caregivers;

      assert.equal(caregiver.phone, undefined);
      assert.equal(caregiver.documents, undefined);
      assert.deepEqual(caregiver.location, { lat: 20.355, lng: 85.818 });
    });

    it('checks the query', async () => {
      const { agent } = await signUp();
      await agent.get('/api/caregivers/nearby').query({ lat: 'x', lng: 85 }).expect(400);
      await nearby(agent, { service: 'gardening' }).expect(400);
    });
  });

  describe('FR-17 caregiver profile', () => {
    it('shows approved caregivers to customers, without a phone number', async () => {
      const caregiver = await addApprovedCaregiver();
      const { agent } = await signUp();

      const res = await agent.get(`/api/caregivers/${caregiver.user.id}`).expect(200);
      assert.equal(res.body.caregiver.policeVerified, true);
      assert.deepEqual(res.body.caregiver.certificates, ['First aid']);
      assert.equal(res.body.caregiver.phone, null);
    });

    it('hides unapproved caregivers from customers', async () => {
      const caregiver = await addSubmittedCaregiver();
      const { agent } = await signUp();
      await agent.get(`/api/caregivers/${caregiver.user.id}`).expect(404);
    });
  });

  describe('FR-18 assignment', () => {
    it('runs from request to acceptance, and only then shares the phone', async () => {
      const caregiver = await addApprovedCaregiver();
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      const assign = () =>
        agent.post(`/api/parents/${parent.id}/assign`).send({ caregiverId: caregiver.user.id });

      await assign().expect(201);

      const waiting = await agent.get(`/api/parents/${parent.id}`).expect(200);
      assert.equal(waiting.body.parent.request.status, 'pending');
      assert.equal(waiting.body.parent.primaryCaregiver, null);
      const hidden = await agent.get(`/api/caregivers/${caregiver.user.id}`);
      assert.equal(hidden.body.caregiver.phone, null);

      const inbox = await caregiver.agent.get('/api/caregivers/me/requests').expect(200);
      assert.equal(inbox.body.requests.length, 1);
      assert.equal(inbox.body.requests[0].parentName, 'Lakshmi Das');
      assert.equal(inbox.body.requests[0].conditions, undefined);
      assert.equal(inbox.body.requests[0].address, undefined);

      await caregiver.agent
        .patch(`/api/caregivers/me/requests/${inbox.body.requests[0].id}`)
        .send({ action: 'accept' })
        .expect(200);

      const assigned = await agent.get(`/api/parents/${parent.id}`).expect(200);
      assert.equal(assigned.body.parent.primaryCaregiver.phone, '9876543210');
      assert.equal(assigned.body.parent.request, null);
      const shown = await agent.get(`/api/caregivers/${caregiver.user.id}`);
      assert.equal(shown.body.caregiver.phone, '9876543210');

      const families = await caregiver.agent.get('/api/caregivers/me/requests').expect(200);
      assert.deepEqual(families.body.families[0].conditions, ['Diabetes']);
      assert.equal(families.body.families[0].role, 'primary');
    });

    it('tells the family when a caregiver declines', async () => {
      const caregiver = await addApprovedCaregiver();
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      await agent
        .post(`/api/parents/${parent.id}/assign`)
        .send({ caregiverId: caregiver.user.id })
        .expect(201);

      const { requests } = (await caregiver.agent.get('/api/caregivers/me/requests')).body;
      await caregiver.agent
        .patch(`/api/caregivers/me/requests/${requests[0].id}`)
        .send({ action: 'decline' })
        .expect(200);

      const res = await agent.get(`/api/parents/${parent.id}`);
      assert.equal(res.body.parent.request.status, 'declined');
      assert.equal(res.body.parent.primaryCaregiver, null);
    });

    it('replaces an open request when the family picks someone else', async () => {
      const first = await addApprovedCaregiver();
      const second = await addApprovedCaregiver();
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      const assign = (caregiverId) =>
        agent.post(`/api/parents/${parent.id}/assign`).send({ caregiverId }).expect(201);

      await assign(first.user.id);
      await assign(second.user.id);

      assert.equal((await first.agent.get('/api/caregivers/me/requests')).body.requests.length, 0);
      assert.equal((await second.agent.get('/api/caregivers/me/requests')).body.requests.length, 1);
    });

    it('needs a running plan, a map pin, and a caregiver who covers the area', async () => {
      const caregiver = await addApprovedCaregiver({ profile: { serviceRadiusKm: 2 } });
      const { agent, user } = await signUp();
      const created = await agent.post('/api/parents').send(PARENT).expect(201);
      const { id } = created.body.parent;
      const assign = () => agent.post(`/api/parents/${id}/assign`).send({ caregiverId: caregiver.user.id });

      assert.match((await assign().expect(409)).body.error.message, /Start a plan/);

      await Subscription.create({
        customerId: user.id,
        parentId: id,
        planId: (await Plan.findOne()).id,
        billingCycle: 'monthly',
        currency: 'INR',
        status: 'active',
        renewsAt: new Date(),
      });
      assert.match((await assign().expect(409)).body.error.message, /does not cover/);

      await Parent.updateOne({ _id: id }, { $unset: { location: 1 } });
      assert.match((await assign().expect(409)).body.error.message, /map pin/);
    });

    it('refuses a caregiver who is not approved', async () => {
      const caregiver = await addSubmittedCaregiver();
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      await agent
        .post(`/api/parents/${parent.id}/assign`)
        .send({ caregiverId: caregiver.user.id })
        .expect(404);
    });

    it('stops caregivers answering each other\'s requests', async () => {
      const caregiver = await addApprovedCaregiver();
      const other = await addApprovedCaregiver();
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      await agent.post(`/api/parents/${parent.id}/assign`).send({ caregiverId: caregiver.user.id });

      const { requests } = (await caregiver.agent.get('/api/caregivers/me/requests')).body;
      await other.agent
        .patch(`/api/caregivers/me/requests/${requests[0].id}`)
        .send({ action: 'accept' })
        .expect(404);
    });

    it('moves the parent to a new primary only once they accept', async () => {
      const first = await addApprovedCaregiver();
      const second = await addApprovedCaregiver();
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);

      const accept = async (caregiver) => {
        await agent
          .post(`/api/parents/${parent.id}/assign`)
          .send({ caregiverId: caregiver.user.id })
          .expect(201);
        const { requests } = (await caregiver.agent.get('/api/caregivers/me/requests')).body;
        return caregiver.agent
          .patch(`/api/caregivers/me/requests/${requests[0].id}`)
          .send({ action: 'accept' })
          .expect(200);
      };

      await accept(first);
      await accept(second);

      assert.equal((await Parent.findById(parent.id)).primaryCaregiverId.toString(), second.user.id);
      assert.equal((await Assignment.findOne({ caregiverId: first.user.id })).status, 'ended');
      assert.equal((await first.agent.get('/api/caregivers/me/requests')).body.families.length, 0);
    });

    it('lets the care manager assign a backup, and nobody else', async () => {
      const caregiver = await addApprovedCaregiver();
      const manager = await signUp('careManager');
      const stranger = await signUp('careManager');
      const { agent, user } = await signUp();
      const parent = await addParentWithPlan(agent, user.id);
      await Parent.updateOne({ _id: parent.id }, { careManagerId: manager.user.id });
      const body = { caregiverId: caregiver.user.id, type: 'backup' };

      await agent.post(`/api/parents/${parent.id}/assign`).send(body).expect(403);
      await stranger.agent.post(`/api/parents/${parent.id}/assign`).send(body).expect(404);
      await manager.agent.post(`/api/parents/${parent.id}/assign`).send(body).expect(201);

      const res = await agent.get(`/api/parents/${parent.id}`);
      assert.equal(res.body.parent.backupCaregiver.id, caregiver.user.id);
    });
  });
});
