import mongoose from 'mongoose';

const rateLimitSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  hits: { type: Number, required: true },
  resetAt: { type: Date, required: true, expires: 0 },
});

export const RateLimit = mongoose.model('RateLimit', rateLimitSchema);
