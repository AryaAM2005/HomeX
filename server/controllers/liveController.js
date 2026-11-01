import { LiveEvent } from '../models/LiveEvent.js';
import { runDueJobs } from '../utils/scheduler.js';

// Covers clocks that differ between servers. Pages drop the repeats by event id.
const OVERLAP_MS = 10_000;
const MAX_EVENTS = 50;

export const toPublicLiveEvent = (liveEvent) => ({
  id: String(liveEvent._id),
  event: liveEvent.event,
  payload: liveEvent.payload ?? {},
});

export async function getLiveEvents(req, res) {
  // Vercel keeps nothing running between requests, so open pages keep the schedule moving.
  await runDueJobs();

  const now = new Date();
  const { after } = req.validQuery;

  const liveEvents = after
    ? await LiveEvent.find({
        userId: req.user.id,
        createdAt: { $gt: new Date(after.getTime() - OVERLAP_MS) },
      })
        .sort({ createdAt: -1 })
        .limit(MAX_EVENTS)
        .lean()
    : [];

  res.set('Cache-Control', 'no-store');
  res.json({ now, events: liveEvents.reverse().map(toPublicLiveEvent) });
}
