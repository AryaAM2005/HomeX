import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

export const REFERRAL_CREDIT_INR = 500;

const referralSchema = new mongoose.Schema(
  {
    referrerId: { type: ObjectId, ref: 'User', required: true, index: true },
    refereeId: { type: ObjectId, ref: 'User', required: true, unique: true },
    code: { type: String, required: true },
    status: { type: String, enum: ['pending', 'credited'], default: 'pending' },
    creditedAt: { type: Date },
  },
  { timestamps: true },
);

export const Referral = mongoose.model('Referral', referralSchema);
