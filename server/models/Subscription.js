import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const subscriptionSchema = new mongoose.Schema(
  {
    customerId: { type: ObjectId, ref: 'User', required: true, index: true },
    parentId: { type: ObjectId, ref: 'Parent', required: true },
    planId: { type: ObjectId, ref: 'Plan', required: true },
    billingCycle: { type: String, enum: ['monthly', 'annual'], required: true },
    currency: { type: String, enum: ['INR', 'USD'], required: true },
    status: { type: String, enum: ['trial', 'active', 'cancelled'], required: true },
    trialEndsAt: { type: Date },
    // The next charge date. After cancelling, it is the date that care ends.
    renewsAt: { type: Date, required: true },
    cancelledAt: { type: Date },
    discountCode: { type: String },
    discountPct: { type: Number, default: 0 },
  },
  { timestamps: true },
);

subscriptionSchema.index({ status: 1, renewsAt: 1 });

// Each parent can have one running plan at a time.
subscriptionSchema.index(
  { parentId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['trial', 'active'] } } },
);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
