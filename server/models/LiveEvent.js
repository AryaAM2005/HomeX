import mongoose from 'mongoose';

const LIVE_EVENT_TTL_SECONDS = 60 * 60;

// A short-lived mailbox for open pages. Anything older is already on the page after a reload.
const liveEventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: LIVE_EVENT_TTL_SECONDS },
});

liveEventSchema.index({ userId: 1, createdAt: 1 });

export const LiveEvent = mongoose.model('LiveEvent', liveEventSchema);
