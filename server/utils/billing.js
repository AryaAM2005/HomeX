import { Payment } from '../models/Payment.js';
import { Plan } from '../models/Plan.js';
import { Referral, REFERRAL_CREDIT_INR } from '../models/Referral.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { refundPayment, takePayment } from './payments.js';
import { addBillingCycle, quotePrice } from './pricing.js';
import { SERVICE_CATALOG } from './services.js';

async function spendCredit(customerId, amountInr) {
  if (amountInr === 0) return true;
  const result = await User.updateOne(
    { _id: customerId, credit: { $gte: amountInr } },
    { $inc: { credit: -amountInr } },
  );
  return result.modifiedCount === 1;
}

// A referral succeeds on the new family's first payment, so a free trial alone earns nothing.
async function rewardReferral(customerId) {
  const referral = await Referral.findOneAndUpdate(
    { refereeId: customerId, status: 'pending' },
    { status: 'credited', creditedAt: new Date() },
  );
  if (!referral) return;

  await User.updateMany(
    { _id: { $in: [referral.referrerId, referral.refereeId] } },
    { $inc: { credit: REFERRAL_CREDIT_INR } },
  );
}

// Charges one billing period and returns the payment, or null if nothing was charged.
export async function billSubscription(subscription, { periodStart = new Date() } = {}) {
  const customer = await User.findById(subscription.customerId);
  if (!customer?.isActive) return null;

  // Moving the date first means a double click or an overlapping job cannot charge twice.
  const claimed = await Subscription.findOneAndUpdate(
    { _id: subscription.id, status: subscription.status, renewsAt: subscription.renewsAt },
    { status: 'active', renewsAt: addBillingCycle(periodStart, subscription.billingCycle) },
    { returnDocument: 'after' },
  );
  if (!claimed) return null;

  const plan = await Plan.findById(claimed.planId);
  const terms = {
    plan,
    currency: claimed.currency,
    billingCycle: claimed.billingCycle,
    discountPct: claimed.discountPct,
  };

  let price = quotePrice({ ...terms, creditInr: customer.credit });
  if (!(await spendCredit(customer.id, price.creditUsedInr))) price = quotePrice(terms);

  const { provider, reference } = await takePayment();
  const payment = await Payment.create({
    customerId: customer.id,
    subscriptionId: claimed.id,
    description: `${plan.name} plan, ${claimed.billingCycle}`,
    amount: price.total,
    currency: claimed.currency,
    discount: price.discount,
    creditApplied: price.creditApplied,
    creditUsedInr: price.creditUsedInr,
    provider,
    reference,
  });

  await rewardReferral(customer.id);
  return payment;
}

export function quoteVisit(serviceType, currency, creditInr) {
  return quotePrice({
    plan: SERVICE_CATALOG[serviceType],
    currency,
    billingCycle: 'monthly',
    creditInr,
  });
}

// Referral credit comes from plans only, because a booking can be refunded.
export async function chargeForVisit({ customer, booking }) {
  const { serviceType, currency } = booking;
  const terms = [serviceType, currency];

  let price = quoteVisit(...terms, customer.credit);
  if (!(await spendCredit(customer.id, price.creditUsedInr))) price = quoteVisit(...terms, 0);

  const { provider, reference } = await takePayment();
  return Payment.create({
    customerId: customer.id,
    bookingId: booking.id,
    description: SERVICE_CATALOG[serviceType].label,
    amount: price.total,
    currency,
    creditApplied: price.creditApplied,
    creditUsedInr: price.creditUsedInr,
    provider,
    reference,
  });
}

export async function refundVisit(paymentId) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: 'paid' },
    { status: 'refunded' },
    { returnDocument: 'after' },
  );
  if (!payment) return;

  await refundPayment(payment.reference);
  if (payment.creditUsedInr > 0) {
    await User.updateOne({ _id: payment.customerId }, { $inc: { credit: payment.creditUsedInr } });
  }
}
