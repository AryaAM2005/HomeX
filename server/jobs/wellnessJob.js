import cron from 'node-cron';
import { addDays, istDate, mondayOf, startOfIstDay } from '../utils/time.js';
import { createWellnessReport } from '../utils/wellness.js';
import { findCoveredParents } from './careJob.js';

// Reports on the last full Monday to Sunday. Each week's report is only ever
// saved once, so running this hourly simply retries anything that failed.
export async function generateWellnessReports(now = new Date()) {
  const thisMonday = mondayOf(istDate(now));
  const weekStart = addDays(thisMonday, -7);

  for (const { parent, plan, subscription } of await findCoveredParents()) {
    // A family that joined this week has no finished week to report on.
    if (subscription.createdAt >= startOfIstDay(thisMonday)) continue;

    try {
      await createWellnessReport({ parent, plan, weekStart });
    } catch (err) {
      console.error(`Could not create a wellness report for ${parent.id}:`, err);
    }
  }
}

export function startWellnessJob() {
  const run = () => generateWellnessReports().catch((err) => console.error(err));
  cron.schedule('5 * * * *', run);
  run();
}
