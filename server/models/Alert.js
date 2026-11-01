import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const alertSchema = new mongoose.Schema(
  {
    parentId: { type: ObjectId, ref: 'Parent', required: true },
    customerId: { type: ObjectId, ref: 'User', required: true },
    careManagerId: { type: ObjectId, ref: 'User' },
    type: {
      type: String,
      enum: ['sos', 'missed_checkin', 'missed_medicine', 'abnormal_vitals'],
      required: true,
    },
    severity: { type: String, enum: ['critical', 'high', 'medium'], required: true },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    message: { type: String, required: true },
    raisedBy: { type: ObjectId, ref: 'User' },
    raisedVia: { type: String, enum: ['customer', 'caregiver', 'parent', 'system'], required: true },
    escalatedAt: { type: Date },
    history: [
      {
        _id: false,
        status: { type: String, required: true },
        note: { type: String, trim: true },
        by: { type: String },
        at: { type: Date, required: true },
      },
    ],
    // Stops a job or a repeated check-in raising the same alert twice.
    dedupeKey: { type: String },
  },
  { timestamps: true },
);

alertSchema.index({ customerId: 1, createdAt: -1 });
alertSchema.index({ careManagerId: 1, status: 1, createdAt: -1 });
alertSchema.index({ type: 1, status: 1, escalatedAt: 1, createdAt: 1 });
alertSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Alert = mongoose.model('Alert', alertSchema);
