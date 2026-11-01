import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const paymentSchema = new mongoose.Schema(
  {
    customerId: { type: ObjectId, ref: 'User', required: true, index: true },
    subscriptionId: { type: ObjectId, ref: 'Subscription' },
    bookingId: { type: ObjectId, ref: 'Booking' },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['INR', 'USD'], required: true },
    discount: { type: Number, default: 0 },
    creditApplied: { type: Number, default: 0 },
    creditUsedInr: { type: Number, default: 0 },
    status: { type: String, enum: ['paid', 'refunded'], default: 'paid' },
    provider: { type: String, required: true },
    reference: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Payment = mongoose.model('Payment', paymentSchema);
