import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://unused/homex';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

// Imported after the variables above, because env.js reads them on load.
const { app } = await import('../app.js');
const { requireAuth, requireRole } = await import('../middleware/auth.js');
const { errorHandler } = await import('../middleware/errorHandler.js');
const { ConsentLog } = await import('../models/ConsentLog.js');
const { MongoRateLimitStore } = await import('../middleware/rateLimit.js');
const { RateLimit } = await import('../models/RateLimit.js');
const { User } = await import('../models/User.js');

// Stand-in for the role-protected routes that arrive in later phases.
const guarded = express();
guarded.use(cookieParser());
guarded.get('/admin-only', requireAuth, requireRole('admin'), (req, res) => res.json({ ok: true }));
guarded.use(errorHandler);

const account = {
  name: 'Ananya Das',
  email: 'ananya@example.com',
  phone: '98765 43210',
  password: 'correct-horse',
  role: 'customer',
  consent: true,
};

describe('auth API', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await User.init();
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(() => Promise.all([User.deleteMany({}), ConsentLog.deleteMany({})]));

  it('FR-1 registers a user and signs them in', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(account).expect(201);

    assert.equal(res.body.user.email, account.email);
    assert.equal(res.body.user.phone, '9876543210');
    assert.equal(res.body.user.passwordHash, undefined);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/);
    assert.match(res.headers['set-cookie'][0], /SameSite=Lax/);

    await agent.get('/api/auth/me').expect(200);
  });

  it('NFR-1 stores a bcrypt hash with at least 10 rounds', async () => {
    await request(app).post('/api/auth/register').send(account).expect(201);
    const { passwordHash } = await User.findOne({ email: account.email }).select('+passwordHash');
    assert.ok(Number(passwordHash.split('$')[2]) >= 10);
  });

  it('FR-1 returns field errors for invalid details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...account, email: 'nope', phone: '123', password: 'short' })
      .expect(400);

    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['email', 'password', 'phone']);
  });

  it('FR-1 refuses a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(account).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...account, email: 'ANANYA@example.com' })
      .expect(409);

    assert.ok(res.body.error.fields.email);
  });

  it('FR-1 does not allow signing up as staff', async () => {
    for (const role of ['admin', 'careManager']) {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...account, role })
        .expect(400);

      assert.ok(res.body.error.fields.role);
    }
  });

  it('FR-1 requires DPDP consent and logs it', async () => {
    const { consent, ...withoutConsent } = account;
    assert.equal(consent, true);

    const refused = await request(app).post('/api/auth/register').send(withoutConsent).expect(400);
    assert.ok(refused.body.error.fields.consent);
    assert.equal(await User.countDocuments(), 0);

    const res = await request(app).post('/api/auth/register').send(account).expect(201);
    const log = await ConsentLog.findOne({ userId: res.body.user.id });
    assert.equal(log.purpose, 'account_and_care_data');
    assert.ok(log.policyVersion);
  });

  it('NFR-9 accepts international numbers for NRI customers', async () => {
    const nri = { ...account, country: 'US', timezone: 'America/New_York' };

    const refused = await request(app)
      .post('/api/auth/register')
      .send({ ...nri, phone: '4155550100' })
      .expect(400);
    assert.ok(refused.body.error.fields.phone);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...nri, phone: '+1 415 555 0100' })
      .expect(201);
    assert.equal(res.body.user.phone, '+14155550100');
    assert.equal(res.body.user.timezone, 'America/New_York');
  });

  it('FR-10 gives customers a referral code, and not caregivers', async () => {
    const customer = await request(app).post('/api/auth/register').send(account).expect(201);
    assert.match(customer.body.user.referralCode, /^HX[0-9A-F]{8}$/);

    const caregiver = await request(app)
      .post('/api/auth/register')
      .send({ ...account, email: 'priya@example.com', role: 'caregiver' })
      .expect(201);
    assert.equal(caregiver.body.user.referralCode, null);
  });

  it('FR-2 logs in with the right password only', async () => {
    await request(app).post('/api/auth/register').send(account).expect(201);

    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'wrong-password' })
      .expect(401);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(200);

    assert.equal(res.body.user.role, 'customer');
  });

  it('FR-3 logout invalidates the token on the server, not only the cookie', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(account).expect(201);
    const stolenCookie = res.headers['set-cookie'][0].split(';')[0];

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', stolenCookie).expect(401);
  });

  it('FR-3 logout still succeeds with no session', async () => {
    await request(app).post('/api/auth/logout').expect(204);
  });

  it('FR-4 rejects other roles and anonymous users', async () => {
    await request(guarded).get('/admin-only').expect(401);

    const res = await request(app).post('/api/auth/register').send(account).expect(201);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    await request(guarded).get('/admin-only').set('Cookie', cookie).expect(403);

    await User.updateOne({ email: account.email }, { role: 'admin' });
    await request(guarded).get('/admin-only').set('Cookie', cookie).expect(200);
  });

  it('FR-32 blocks a deactivated account, including its open sessions', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(account).expect(201);
    await User.updateOne({ email: account.email }, { isActive: false });

    await agent.get('/api/auth/me').expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(403);
  });

  it('FR-5 resets a password with a one-time emailed link', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(account).expect(201);

    const log = mock.method(console, 'log', () => {});
    await request(app).post('/api/auth/forgot-password').send({ email: account.email }).expect(200);
    const token = log.mock.calls[0].arguments[0].match(/reset-password\/(\w+)/)[1];
    log.mock.restore();

    const body = { token, password: 'a-brand-new-password' };
    await request(app).post('/api/auth/reset-password').send(body).expect(200);
    await request(app).post('/api/auth/reset-password').send(body).expect(400);

    await agent.get('/api/auth/me').expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: account.password })
      .expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ email: account.email, password: 'a-brand-new-password' })
      .expect(200);
  });

  it('FR-5 gives the same answer for unknown emails', async () => {
    await request(app).post('/api/auth/register').send(account).expect(201);
    const log = mock.method(console, 'log', () => {});
    const known = await request(app).post('/api/auth/forgot-password').send({ email: account.email });
    log.mock.restore();
    const unknown = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    assert.equal(known.status, unknown.status);
    assert.deepEqual(known.body, unknown.body);
  });

  it('NFR-1 counts rate limits in the database, so every server shares them', async () => {
    const store = new MongoRateLimitStore('test');
    store.init({ windowMs: 60_000 });

    assert.equal((await store.increment('ip')).totalHits, 1);
    await Promise.all([store.increment('ip'), store.increment('ip'), store.increment('ip')]);
    assert.equal((await store.increment('ip')).totalHits, 5);

    await store.decrement('ip');
    assert.equal((await store.increment('ip')).totalHits, 5);

    await Promise.all([store.increment('fresh'), store.increment('fresh'), store.increment('fresh')]);
    assert.equal((await store.increment('fresh')).totalHits, 4);

    await RateLimit.updateOne({ _id: 'test:ip' }, { resetAt: new Date(Date.now() - 1000) });
    const restarted = await store.increment('ip');
    assert.equal(restarted.totalHits, 1);
    assert.ok(restarted.resetTime > new Date());
  });

  it('NFR-10 returns JSON errors for unknown routes and malformed bodies', async () => {
    const missing = await request(app).get('/api/nope').expect(404);
    assert.ok(missing.body.error.message);

    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{not json')
      .expect(400);
    assert.ok(malformed.body.error.message);
  });
});
