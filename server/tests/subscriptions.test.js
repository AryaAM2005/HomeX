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
const { processDueSubscriptions } = await import('../jobs/subscriptionJob.js');
const { EmployerCode } = await import('../models/EmployerCode.js');
const { Parent } = await import('../models/Parent.js');
const { Payment } = await import('../models/Payment.js');
const { Plan } = await import('../models/Plan.js');
const { Referral } = await import('../models/Referral.js');
const { Subscription } = await import('../models/Subscription.js');
const { User } = await import('../models/User.js');
const { ensurePlans } = await import('../utils/ensurePlans.js');
const { addBillingCycle, quotePrice } = await import('../utils/pricing.js');

let accountCount = 0;

async function signUp(overrides = {}) {
  accountCount += 1;
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({
      name: `Customer ${accountCount}`,
      email: `customer${accountCount}@example.com`,
      phone: '9876543210',
      password: 'correct-horse',
      role: 'customer',
      consent: true,
      ...overrides,
    })
    .expect(201);
  return { agent, user: res.body.user };
}

async function addParent(agent, name = 'Lakshmi') {
  const res = await agent.post('/api/parents').send({ name }).expect(201);
  return res.body.parent;
}

async function signInAsAdmin() {
  const { agent, user } = await signUp();
  await User.updateOne({ _id: user.id }, { role: 'admin' });
  return agent;
}

const planNamed = (name) => Plan.findOne({ name });

async function subscribe(agent, overrides = {}) {
  const parent = overrides.parentId ? null : await addParent(agent);
  const plan = await planNamed('Standard');
  return agent.post('/api/subscriptions').send({
    planId: plan.id,
    parentId: parent?.id,
    billingCycle: 'monthly',
    currency: 'INR',
    ...overrides,
  });
}

describe('plans and subscriptions', () => {
  let mongo;

  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all(
      [Plan, Subscription, EmployerCode, Referral, User].map((model) => model.init()),
    );
  });

  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      [Plan, Parent, Subscription, Payment, Referral, EmployerCode, User].map((model) =>
        model.deleteMany({}),
      ),
    );
    await ensurePlans();
  });

  describe('FR-7 plans', () => {
    it('lists active plans publicly with INR, USD and annual prices', async () => {
      const res = await request(app).get('/api/plans').expect(200);

      assert.deepEqual(
        res.body.plans.map((plan) => plan.name),
        ['Basic', 'Standard', 'Premium'],
      );
      assert.deepEqual(res.body.plans[1].prices, {
        INR: { monthly: 2499, annual: 24990 },
        USD: { monthly: 29, annual: 290 },
      });
    });

    it('does not overwrite plans an admin has changed', async () => {
      await Plan.updateOne({ name: 'Basic' }, { priceInr: 599 });
      await ensurePlans();
      assert.equal((await planNamed('Basic')).priceInr, 599);
    });

    it('lets only an admin edit a plan', async () => {
      const plan = await planNamed('Basic');
      const { agent: customer } = await signUp();
      await customer.patch(`/api/admin/plans/${plan.id}`).send({ priceInr: 599 }).expect(403);

      const admin = await signInAsAdmin();
      await admin.patch(`/api/admin/plans/${plan.id}`).send({ priceInr: -1 }).expect(400);
      const res = await admin.patch(`/api/admin/plans/${plan.id}`).send({ priceInr: 599 }).expect(200);
      assert.equal(res.body.plan.prices.INR.annual, 5990);
    });

    it('hides a deactivated plan and refuses new subscriptions to it', async () => {
      const plan = await planNamed('Premium');
      const admin = await signInAsAdmin();
      await admin.patch(`/api/admin/plans/${plan.id}`).send({ active: false }).expect(200);

      const res = await request(app).get('/api/plans').expect(200);
      assert.equal(res.body.plans.length, 2);

      const { agent } = await signUp();
      const refused = await subscribe(agent, { planId: plan.id });
      assert.equal(refused.status, 404);
      assert.equal(await Subscription.countDocuments(), 0);
    });
  });

  describe('FR-8 subscribing', () => {
    it('starts a 7-day trial with no payment on the first plan', async () => {
      const { agent } = await signUp();
      const res = await subscribe(agent);

      assert.equal(res.status, 201);
      assert.equal(res.body.subscription.status, 'trial');
      assert.equal(res.body.paid, false);
      assert.equal(await Payment.countDocuments(), 0);

      const days = (new Date(res.body.subscription.trialEndsAt) - Date.now()) / 86_400_000;
      assert.ok(days > 6.99 && days <= 7);
    });

    it('charges the second plan straight away, with no second trial', async () => {
      const { agent } = await signUp();
      await subscribe(agent);
      const res = await subscribe(agent, { billingCycle: 'annual' });

      assert.equal(res.body.subscription.status, 'active');
      assert.equal(res.body.paid, true);
      const payment = await Payment.findOne();
      assert.equal(payment.amount, 24990);
      assert.equal(payment.provider, 'mock');
    });

    it('does not give a second trial after cancelling the first plan', async () => {
      const { agent } = await signUp();
      const first = await subscribe(agent);
      await agent
        .patch(`/api/subscriptions/${first.body.subscription.id}`)
        .send({ action: 'cancel' })
        .expect(200);

      const second = await subscribe(agent);
      assert.equal(second.body.subscription.status, 'active');
    });

    it('allows one running plan per parent', async () => {
      const { agent } = await signUp();
      const parent = await addParent(agent);
      await subscribe(agent, { parentId: parent.id });

      const res = await subscribe(agent, { parentId: parent.id });
      assert.equal(res.status, 409);
    });

    it("refuses another customer's parent", async () => {
      const { agent: owner } = await signUp();
      const parent = await addParent(owner);
      const { agent: other } = await signUp();

      const res = await subscribe(other, { parentId: parent.id });
      assert.equal(res.status, 404);
    });

    it('is only for customers', async () => {
      const { agent } = await signUp({ role: 'caregiver' });
      await agent.get('/api/subscriptions').expect(403);
      await request(app).get('/api/subscriptions').expect(401);
    });

    it('charges in USD for NRI families', async () => {
      const { agent } = await signUp();
      await subscribe(agent);
      const res = await subscribe(agent, { currency: 'USD' });

      assert.equal(res.body.subscription.nextCharge, 29);
      const payment = await Payment.findOne();
      assert.equal(payment.currency, 'USD');
      assert.equal(payment.amount, 29);
    });
  });

  describe('FR-9 changing a plan', () => {
    it('upgrades now and bills the new price at renewal', async () => {
      const { agent } = await signUp();
      const { body } = await subscribe(agent);
      const premium = await planNamed('Premium');

      const res = await agent
        .patch(`/api/subscriptions/${body.subscription.id}`)
        .send({ action: 'change_plan', planId: premium.id, billingCycle: 'monthly' })
        .expect(200);

      assert.equal(res.body.subscription.plan.name, 'Premium');
      assert.equal(res.body.subscription.nextCharge, 9999);
      assert.equal(res.body.subscription.status, 'trial');
      assert.equal(await Payment.countDocuments(), 0);
    });

    it('refuses a change to the same plan and cycle', async () => {
      const { agent } = await signUp();
      const { body } = await subscribe(agent);

      await agent
        .patch(`/api/subscriptions/${body.subscription.id}`)
        .send({ action: 'change_plan', planId: body.subscription.plan.id, billingCycle: 'monthly' })
        .expect(400);
    });

    it('stops charging a cancelled plan and keeps the end date', async () => {
      const { agent } = await signUp();
      const { body } = await subscribe(agent);
      const res = await agent
        .patch(`/api/subscriptions/${body.subscription.id}`)
        .send({ action: 'cancel' })
        .expect(200);

      assert.equal(res.body.subscription.status, 'cancelled');
      assert.equal(res.body.subscription.renewsAt, body.subscription.renewsAt);
      assert.equal(res.body.subscription.nextCharge, null);

      await processDueSubscriptions(new Date(Date.now() + 30 * 86_400_000));
      assert.equal(await Payment.countDocuments(), 0);

      await agent
        .patch(`/api/subscriptions/${body.subscription.id}`)
        .send({ action: 'pay_now' })
        .expect(409);
    });

    it("cannot touch another customer's subscription", async () => {
      const { agent: owner } = await signUp();
      const { body } = await subscribe(owner);
      const { agent: other } = await signUp();

      await other
        .patch(`/api/subscriptions/${body.subscription.id}`)
        .send({ action: 'cancel' })
        .expect(404);
      await other.patch('/api/subscriptions/not-an-id').send({ action: 'cancel' }).expect(404);
    });

    it('ends a trial early with pay_now, and charges only once', async () => {
      const { agent } = await signUp();
      const { body } = await subscribe(agent);
      const url = `/api/subscriptions/${body.subscription.id}`;

      await Promise.all([
        agent.patch(url).send({ action: 'pay_now' }),
        agent.patch(url).send({ action: 'pay_now' }),
      ]);

      assert.equal(await Payment.countDocuments(), 1);
      assert.equal((await Subscription.findById(body.subscription.id)).status, 'active');
    });
  });

  describe('billing job', () => {
    it('converts an expired trial and renews a month later', async () => {
      const { agent } = await signUp();
      const { body } = await subscribe(agent);
      const trialEnd = new Date(body.subscription.trialEndsAt);

      await processDueSubscriptions(new Date(trialEnd.getTime() - 1000));
      assert.equal(await Payment.countDocuments(), 0);

      await processDueSubscriptions(new Date(trialEnd.getTime() + 1000));
      const subscription = await Subscription.findById(body.subscription.id);
      assert.equal(subscription.status, 'active');
      assert.equal(await Payment.countDocuments(), 1);
      assert.deepEqual(subscription.renewsAt, addBillingCycle(trialEnd, 'monthly'));

      await processDueSubscriptions(new Date(trialEnd.getTime() + 1000));
      assert.equal(await Payment.countDocuments(), 1);

      await processDueSubscriptions(new Date(subscription.renewsAt.getTime() + 1000));
      assert.equal(await Payment.countDocuments(), 2);
    });

    it('skips deactivated customers', async () => {
      const { agent, user } = await signUp();
      await subscribe(agent);
      await User.updateOne({ _id: user.id }, { isActive: false });

      await processDueSubscriptions(new Date(Date.now() + 8 * 86_400_000));
      assert.equal(await Payment.countDocuments(), 0);
    });
  });

  describe('FR-10 referrals', () => {
    it('credits Rs. 500 to both families on the first payment, not the trial', async () => {
      const { user: referrer } = await signUp();
      const { agent, user: referee } = await signUp();
      const { body } = await subscribe(agent, { code: referrer.referralCode.toLowerCase() });

      assert.equal((await User.findById(referee.id)).credit, 0);
      assert.equal((await User.findById(referrer.id)).credit, 0);

      await agent.patch(`/api/subscriptions/${body.subscription.id}`).send({ action: 'pay_now' });

      assert.equal((await User.findById(referee.id)).credit, 500);
      assert.equal((await User.findById(referrer.id)).credit, 500);
      assert.equal((await Referral.findOne()).status, 'credited');
    });

    it('pays each referral once', async () => {
      const { user: referrer } = await signUp();
      const { agent, user: referee } = await signUp();
      const { body } = await subscribe(agent, { code: referrer.referralCode });
      await agent.patch(`/api/subscriptions/${body.subscription.id}`).send({ action: 'pay_now' });
      await subscribe(agent);

      assert.equal((await User.findById(referrer.id)).credit, 500);
      assert.equal(await Referral.countDocuments({ refereeId: referee.id }), 1);
    });

    it('refuses your own code, and a code on a later plan', async () => {
      const { agent, user } = await signUp();
      const own = await subscribe(agent, { code: user.referralCode });
      assert.equal(own.status, 400);
      assert.ok(own.body.error.fields.code);

      await subscribe(agent);
      const { user: other } = await signUp();
      const late = await subscribe(agent, { code: other.referralCode });
      assert.equal(late.status, 400);
    });

    it('spends credit on the next payment', async () => {
      const { agent, user } = await signUp();
      await User.updateOne({ _id: user.id }, { credit: 500 });
      await subscribe(agent);
      await subscribe(agent);

      const payment = await Payment.findOne();
      assert.equal(payment.amount, 1999);
      assert.equal(payment.creditApplied, 500);
      assert.equal((await User.findById(user.id)).credit, 0);
    });

    it('shows the referrer first names only', async () => {
      const { agent: referrerAgent, user: referrer } = await signUp();
      const { agent } = await signUp({ name: 'Ananya Das' });
      await subscribe(agent, { code: referrer.referralCode });

      const res = await referrerAgent.get('/api/referrals').expect(200);
      assert.equal(res.body.referrals[0].name, 'Ananya');
      assert.equal(res.body.referrals[0].status, 'pending');
    });
  });

  describe('FR-11 employer codes', () => {
    it('sets 10% for 10+ employees and 20% for 50+', async () => {
      const admin = await signInAsAdmin();
      const small = await admin
        .post('/api/admin/employer-codes')
        .send({ code: 'acme10', company: 'Acme', employeeCount: 49 })
        .expect(201);
      const large = await admin
        .post('/api/admin/employer-codes')
        .send({ code: 'BIGCO', company: 'BigCo', employeeCount: 50 })
        .expect(201);

      assert.equal(small.body.employerCode.code, 'ACME10');
      assert.equal(small.body.employerCode.discountPct, 10);
      assert.equal(large.body.employerCode.discountPct, 20);
    });

    it('refuses fewer than 10 employees, reserved prefixes and duplicates', async () => {
      const admin = await signInAsAdmin();
      const body = { code: 'ACME10', company: 'Acme', employeeCount: 10 };

      await admin.post('/api/admin/employer-codes').send({ ...body, employeeCount: 9 }).expect(400);
      await admin.post('/api/admin/employer-codes').send({ ...body, code: 'HXAB12' }).expect(400);
      await admin.post('/api/admin/employer-codes').send(body).expect(201);
      await admin.post('/api/admin/employer-codes').send(body).expect(409);
    });

    it('applies the discount to every charge', async () => {
      await EmployerCode.create({ code: 'BIGCO', company: 'BigCo', employeeCount: 60, discountPct: 20 });
      const { agent } = await signUp();
      const { body } = await subscribe(agent, { code: 'bigco' });

      assert.equal(body.subscription.discountPct, 20);
      assert.equal(body.subscription.nextCharge, 1999);

      await agent.patch(`/api/subscriptions/${body.subscription.id}`).send({ action: 'pay_now' });
      const payment = await Payment.findOne();
      assert.equal(payment.amount, 1999);
      assert.equal(payment.discount, 500);
    });

    it('refuses an inactive or unknown code', async () => {
      await EmployerCode.create({
        code: 'OLDCO',
        company: 'OldCo',
        employeeCount: 20,
        discountPct: 10,
        active: false,
      });
      const { agent } = await signUp();

      for (const code of ['OLDCO', 'NOPE']) {
        const res = await subscribe(agent, { code });
        assert.equal(res.status, 400);
        assert.ok(res.body.error.fields.code);
      }
      assert.equal(await Subscription.countDocuments(), 0);
    });
  });

  describe('quotes', () => {
    it('previews the price, trial and code without saving anything', async () => {
      await EmployerCode.create({ code: 'ACME', company: 'Acme', employeeCount: 20, discountPct: 10 });
      const { agent } = await signUp();
      const plan = await planNamed('Standard');

      const res = await agent
        .post('/api/subscriptions/quote')
        .send({ planId: plan.id, billingCycle: 'annual', currency: 'INR', code: 'acme' })
        .expect(200);

      assert.equal(res.body.trial, true);
      assert.equal(res.body.price.base, 24990);
      assert.equal(res.body.price.discount, 2499);
      assert.equal(res.body.price.total, 22491);
      assert.equal(res.body.code.label, '10% off from Acme');
      assert.equal(await Subscription.countDocuments(), 0);
    });
  });

  describe('pricing', () => {
    const plan = { priceInr: 2499, usdPrice: 29 };

    it('never takes more credit than the amount due', () => {
      const price = quotePrice({
        plan: { priceInr: 499, usdPrice: 6 },
        currency: 'INR',
        billingCycle: 'monthly',
        creditInr: 1000,
      });
      assert.equal(price.total, 0);
      assert.equal(price.creditUsedInr, 499);
    });

    it('converts INR credit for USD payers', () => {
      const price = quotePrice({ plan, currency: 'USD', billingCycle: 'monthly', creditInr: 500 });
      assert.equal(price.creditApplied, 5.8);
      assert.equal(price.total, 23.2);
      assert.equal(price.creditUsedInr, 500);
    });

    it('keeps month-end renewal dates inside the next month', () => {
      const next = addBillingCycle(new Date(2027, 0, 31), 'monthly');
      assert.equal(next.getMonth(), 1);
      assert.equal(next.getDate(), 28);
    });
  });
});
