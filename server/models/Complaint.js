import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const complaintSchema = new mongoose.Schema(
  {
    customerId: { type: ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: ObjectId, ref: 'Booking', required: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolution: { type: String, trim: true },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

complaintSchema.index({ status: 1, createdAt: -1 });

// One open complaint per booking, so a double click cannot file two.
complaintSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: 'open' } },
);

export const Complaint = mongoose.model('Complaint', complaintSchema);
