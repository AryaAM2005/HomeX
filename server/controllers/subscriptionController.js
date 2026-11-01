import { EmployerCode } from '../models/EmployerCode.js';
import { Parent } from '../models/Parent.js';
import { Payment } from '../models/Payment.js';
import { Plan } from '../models/Plan.js';
import { Referral } from '../models/Referral.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { billSubscription } from '../utils/billing.js';
import { quotePrice } from '../utils/pricing.js';

const TRIAL_DAYS = 7;

const codeError = (message) => new ApiError(400, message, { code: message });
const trialEndDate = () => new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

async function findActivePlan(planId) {
  const plan = await Plan.findOne({ _id: planId, active: true });
  if (!plan) throw new ApiError(404, 'This plan is no longer available');
  return plan;
}

async function isFirstSubscription(customer) {
  return !(await Subscription.exists({ customerId: customer.id }));
}

async function resolveCode(code, customer, isFirst) {
  if (!code) return null;

  const employerCode = await EmployerCode.findOne({ code, active: true });
  if (employerCode) {
    return {
      type: 'employer',
      code,
      discountPct: employerCode.discountPct,
      label: `${employerCode.discountPct}% off from ${employerCode.company}`,
    };
  }

  const referrer = await User.findOne({ referralCode: code, role: 'customer', isActive: true });
  if (!referrer) throw codeError('This code is not valid');
  if (referrer.id === customer.id) throw codeError('You cannot use your own referral code');
  if (!isFirst) throw codeError("Referral codes only work on a family's first plan");

  return {
    type: 'referral',
    code,
    discountPct: 0,
    referrerId: referrer.id,
    label: 'Rs. 500 credit for you both after your first payment',
  };
}

function toPublic(subscription) {
  const { planId: plan, parentId: parent } = subscription;
  const isRunning = subscription.status !== 'cancelled';

  return {
    id: subscription.id,
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    currency: subscription.currency,
    trialEndsAt: subscription.trialEndsAt ?? null,
    renewsAt: subscription.renewsAt,
    cancelledAt: subscription.cancelledAt ?? null,
    discountCode: subscription.discountCode ?? null,
    discountPct: subscription.discountPct,
    plan: plan.toPublic(),
    // Cancelled plans outlive a parent's profile, so the billing history stays complete.
    parent: parent ? { id: parent.id, name: parent.name } : { id: null, name: 'Removed parent' },
    nextCharge: isRunning
      ? quotePrice({
          plan,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          discountPct: subscription.discountPct,
        }).total
      : null,
  };
}

const withDetails = (query) => query.populate('planId').populate('parentId');

export async function listSubscriptions(req, res) {
  const subscriptions = await withDetails(
    Subscription.find({ customerId: req.user.id }).sort({ createdAt: -1 }),
  );
  res.json({ subscriptions: subscriptions.map(toPublic), credit: req.user.credit });
}

export async function getQuote(req, res) {
  const { planId, billingCycle, currency, code } = req.body;
  const plan = await findActivePlan(planId);
  const isFirst = await isFirstSubscription(req.user);
  const applied = await resolveCode(code, req.user, isFirst);

  const price = quotePrice({
    plan,
    currency,
    billingCycle,
    discountPct: applied?.discountPct,
    creditInr: req.user.credit,
  });

  res.json({
    plan: plan.toPublic(),
    billingCycle,
    currency,
    price,
    trial: isFirst,
    trialDays: TRIAL_DAYS,
    trialEndsAt: isFirst ? trialEndDate() : null,
    code: applied && { type: applied.type, code: applied.code, label: applied.label },
  });
}

export async function subscribe(req, res) {
  const { planId, parentId, billingCycle, currency, code } = req.body;

  const parent = await Parent.findOne({ _id: parentId, customerId: req.user.id });
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  const plan = await findActivePlan(planId);
  const isFirst = await isFirstSubscription(req.user);
  const applied = await resolveCode(code, req.user, isFirst);

  const trialEndsAt = isFirst ? trialEndDate() : undefined;

  const subscription = await Subscription.create({
    customerId: req.user.id,
    parentId: parent.id,
    planId: plan.id,
    billingCycle,
    currency,
    status: isFirst ? 'trial' : 'active',
    trialEndsAt,
    renewsAt: trialEndsAt ?? new Date(),
    discountCode: applied?.code,
    discountPct: applied?.discountPct ?? 0,
  });

  if (applied?.type === 'referral') {
    await Referral.create({
      referrerId: applied.referrerId,
      refereeId: req.user.id,
      code: applied.code,
    });
  }

  const payment = isFirst ? null : await billSubscription(subscription);
  const created = await withDetails(Subscription.findById(subscription.id));

  res.status(201).json({ subscription: toPublic(created), paid: Boolean(payment) });
}

export async function updateSubscription(req, res) {
  const subscription = await Subscription.findOne({ _id: req.params.id, customerId: req.user.id });
  if (!subscription) throw new ApiError(404, 'We could not find that subscription');
  if (subscription.status === 'cancelled') {
    throw new ApiError(409, 'This plan has been cancelled. Please start a new one.');
  }

  if (req.body.action === 'change_plan') {
    const { planId, billingCycle } = req.body;
    if (subscription.planId.equals(planId) && subscription.billingCycle === billingCycle) {
      throw new ApiError(400, 'You are already on this plan');
    }
    await findActivePlan(planId);
    subscription.planId = planId;
    subscription.billingCycle = billingCycle;
    await subscription.save();
  }

  if (req.body.action === 'cancel') {
    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    await subscription.save();
  }

  if (req.body.action === 'pay_now') {
    if (subscription.status !== 'trial') throw new ApiError(409, 'This plan is already paid for');
    await billSubscription(subscription);
  }

  const updated = await withDetails(Subscription.findById(subscription.id));
  res.json({ subscription: toPublic(updated) });
}

export async function listPayments(req, res) {
  const payments = await Payment.find({ customerId: req.user.id }).sort({ createdAt: -1 }).limit(50);

  res.json({
    payments: payments.map((payment) => ({
      id: payment.id,
      date: payment.createdAt,
      description: payment.description,
      amount: payment.amount,
      currency: payment.currency,
      discount: payment.discount,
      creditApplied: payment.creditApplied,
      status: payment.status,
    })),
  });
}
