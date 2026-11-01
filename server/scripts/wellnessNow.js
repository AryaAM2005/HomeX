// Builds this week's report so far, without waiting for Monday. For demos and testing.
// Run it while the database is up. Safe to run again: it replaces the same week's report.
import mongoose from 'mongoose';
import { findCoveredParents } from '../jobs/careJob.js';
import { env } from '../utils/env.js';
import { istDate, mondayOf } from '../utils/time.js';
import { createWellnessReport } from '../utils/wellness.js';

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

const weekStart = mondayOf(istDate());
const covered = await findCoveredParents();

for (const { parent, plan } of covered) {
  await createWellnessReport({ parent, plan, weekStart, replace: true });
}

console.log(`Built ${covered.length} report(s) for the week of ${weekStart}.`);
await mongoose.disconnect();
