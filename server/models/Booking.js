import mongoose from 'mongoose';
import { SERVICE_TYPES } from '../utils/services.js';

const { ObjectId } = mongoose.Schema.Types;

export const BOOKING_STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'REJECTED',
  'APPOINTMENT_FIXED',
  'IN_PROGRESS',
  'COMPLETED',
  'REPORT_SUBMITTED',
  'CANCELLED',
];

const bookingSchema = new mongoose.Schema(
  {
    customerId: { type: ObjectId, ref: 'User', required: true, index: true },
    parentId: { type: ObjectId, ref: 'Parent', required: true, index: true },
    caregiverId: { type: ObjectId, ref: 'User', required: true, index: true },
    serviceType: { type: String, enum: SERVICE_TYPES, required: true },
    scheduledAt: { type: Date, required: true },
    notes: { type: String, trim: true },
    appointmentDetails: { type: String, trim: true },
    status: { type: String, enum: BOOKING_STATUSES, default: 'REQUESTED' },
    statusHistory: [
      {
        _id: false,
        status: { type: String, required: true },
        by: { type: String, required: true },
        note: { type: String, trim: true },
        at: { type: Date, required: true },
      },
    ],
    currency: { type: String, enum: ['INR', 'USD'], required: true },
    price: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['included', 'paid', 'refunded'], required: true },
    paymentId: { type: ObjectId, ref: 'Payment' },
    caregiverEarningInr: { type: Number, required: true },
  },
  { timestamps: true },
);

bookingSchema.index({ status: 1, scheduledAt: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
