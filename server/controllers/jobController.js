import { ApiError } from '../utils/ApiError.js';
import { env } from '../utils/env.js';
import { runAllDueJobs } from '../utils/scheduler.js';

// Vercel's daily cron calls this, so the schedule still moves when nobody has the site open.
export async function tickJobs(req, res) {
  if (!env.CRON_SECRET || req.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    throw new ApiError(401, 'Not allowed');
  }

  await runAllDueJobs();
  res.json({ status: 'ok' });
}
