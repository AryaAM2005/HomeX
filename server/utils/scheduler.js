import {
  escalateUnansweredSos,
  expireUnansweredBookings,
  flagMissedCheckIns,
  flagMissedMedicines,
  remindTrialEnding,
  sendMedicineReminders,
} from '../jobs/careJob.js';
import { processDueSubscriptions } from '../jobs/subscriptionJob.js';
import { generateWellnessReports } from '../jobs/wellnessJob.js';
import { JobRun } from '../models/JobRun.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Every task is safe to repeat, so a failed or skipped run is covered by the next one.
const JOBS = [
  { name: 'sos', every: 30 * SECOND, tasks: [escalateUnansweredSos] },
  {
    name: 'care',
    every: 15 * MINUTE,
    tasks: [
      sendMedicineReminders,
      flagMissedMedicines,
      flagMissedCheckIns,
      remindTrialEnding,
      expireUnansweredBookings,
    ],
  },
  { name: 'billing', every: HOUR, tasks: [processDueSubscriptions] },
  { name: 'wellness', every: HOUR, tasks: [generateWellnessReports] },
];

const CHECK_EVERY_MS = 15 * SECOND;
let nextCheckAt = 0;

// Only one server wins each run. The unique _id refuses an insert when the job isn't due.
async function claimJob({ name, every }, now) {
  try {
    await JobRun.findOneAndUpdate(
      { _id: name, nextRunAt: { $lte: now } },
      { nextRunAt: new Date(now.getTime() + every) },
      { upsert: true },
    );
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

async function runTask(task) {
  try {
    await task();
  } catch (err) {
    console.error(`${task.name} failed:`, err);
  }
}

export async function runAllDueJobs(now = new Date()) {
  const runs = await JobRun.find({}).lean();
  const isDue = ({ name }) => {
    const run = runs.find(({ _id }) => _id === name);
    return !run || run.nextRunAt <= now;
  };

  for (const job of JOBS.filter(isDue)) {
    if (await claimJob(job, now)) await Promise.all(job.tasks.map(runTask));
  }
}

// Called on every page poll, so this usually returns without touching the database.
export async function runDueJobs(now = new Date()) {
  if (now.getTime() < nextCheckAt) return;
  nextCheckAt = now.getTime() + CHECK_EVERY_MS;

  try {
    await runAllDueJobs(now);
  } catch (err) {
    console.error('Could not run scheduled jobs:', err);
  }
}

export function startScheduler() {
  const run = () => runDueJobs();
  run();
  setInterval(run, CHECK_EVERY_MS);
}
