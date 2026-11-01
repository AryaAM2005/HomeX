import mongoose from 'mongoose';

// Evidence of consent under the DPDP Act, so records are only ever added.
const consentLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, required: true },
    policyVersion: { type: String, required: true },
    ip: { type: String },
    userAgent: { type: String },
    withdrawnAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ConsentLog = mongoose.model('ConsentLog', consentLogSchema);
