import cron from 'node-cron';
import { expireBooking } from '../controllers/bookingController.js';
import { Alert } from '../models/Alert.js';
import { Assignment } from '../models/Assignment.js';
import { Booking } from '../models/Booking.js';
import { CheckIn } from '../models/CheckIn.js';
import { Medicine } from '../models/Medicine.js';
import { Parent } from '../models/Parent.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { raiseAlert, escalateAlert } from '../utils/alerts.js';
import { notify } from '../utils/notifications.js';
import { addIstMinutes, istDate, istTime, startOfIstDay } from '../utils/time.js';

const SOS_ESCALATION_MINUTES = 5;
const REMINDER_LEAD_MINUTES = 15;
const MEDICINE_GRACE_MINUTES = 4 * 60;
const DAILY_CHECKIN_CUTOFF = '20:00';

export async function escalateUnansweredSos(now = new Date()) {
  const cutoff = new Date(now.getTime() - SOS_ESCALATION_MINUTES * 60 * 1000);
  const overdue = await Alert.find({
    type: 'sos',
    status: 'open',
    escalatedAt: { $exists: false },
    createdAt: { $lte: cutoff },
  }).populate('parentId', 'name');

  for (const alert of overdue) {
    await escalateAlert(alert, alert.parentId?.name ?? 'Removed parent');
  }
}

// Parents on a running plan with a caregiver in place, with what their plan promises.
export async function findCoveredParents() {
  const subscriptions = await Subscription.find({ status: { $in: ['trial', 'active'] } });
  const plans = await Plan.find({ _id: { $in: subscriptions.map(({ planId }) => planId) } });
  const parents = await Parent.find({
    _id: { $in: subscriptions.map(({ parentId }) => parentId) },
    primaryCaregiverId: { $exists: true },
  });

  return parents.map((parent) => {
    const subscription = subscriptions.find(({ parentId }) => parentId.equals(parent.id));
    return { parent, subscription, plan: plans.find(({ id }) => subscription.planId.equals(id)) };
  });
}

export async function sendMedicineReminders(now = new Date()) {
  const today = istDate(now);
  const latest = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60 * 1000);

  for (const { parent } of await findCoveredParents()) {
    const medicines = await Medicine.find({ parentId: parent.id });

    for (const medicine of medicines) {
      if (!medicine.isActiveOn(today)) continue;

      for (const time of medicine.times) {
        if (time < istTime(now) || time > istTime(latest)) continue;

        await notify(parent.primaryCaregiverId, {
          title: 'Medicine due soon',
          body: `${parent.name}: ${medicine.name} (${medicine.dose}) at ${time}.`,
          link: '/caregiver',
          dedupeKey: `reminder:${medicine.id}:${today}:${time}`,
        });
      }
    }
  }
}

export async function flagMissedMedicines(now = new Date()) {
  const today = istDate(now);

  for (const { parent, plan } of await findCoveredParents()) {
    // Plans without daily check-ins have nobody logging each dose.
    if (plan.checkinsPerWeek < 7) continue;

    const medicines = await Medicine.find({ parentId: parent.id });
    const checkIns = await CheckIn.find({ parentId: parent.id, date: today }, 'medicinesGiven');
    const logged = new Set(
      checkIns.flatMap(({ medicinesGiven }) =>
        medicinesGiven.map(({ medicineId, time }) => `${medicineId}:${time}`),
      ),
    );

    for (const medicine of medicines) {
      if (!medicine.isActiveOn(today)) continue;

      for (const time of medicine.times) {
        const overdue = addIstMinutes(today, time, MEDICINE_GRACE_MINUTES) <= now;
        if (!overdue || logged.has(`${medicine.id}:${time}`)) continue;

        await raiseAlert({
          parent,
          type: 'missed_medicine',
          message: `${medicine.name} at ${time} India time has not been logged`,
          raisedVia: 'system',
          dedupeKey: `missed_medicine:${medicine.id}:${today}:${time}`,
        });
      }
    }
  }
}

async function caregiverStartedBefore(parent, date) {
  return Assignment.exists({
    parentId: parent.id,
    type: 'primary',
    status: 'accepted',
    respondedAt: { $lt: date },
  });
}

export async function flagMissedCheckIns(now = new Date()) {
  const today = istDate(now);
  if (istTime(now) < DAILY_CHECKIN_CUTOFF) return;

  for (const { parent, plan } of await findCoveredParents()) {
    if (plan.checkinsPerWeek === 0) continue;

    const expectedDays = Math.max(1, Math.round(7 / plan.checkinsPerWeek));
    const windowStart = new Date(startOfIstDay(today).getTime() - (expectedDays - 1) * 86_400_000);

    if (!(await caregiverStartedBefore(parent, windowStart))) continue;
    if (await CheckIn.exists({ parentId: parent.id, time: { $gte: windowStart } })) continue;

    await raiseAlert({
      parent,
      type: 'missed_checkin',
      message: expectedDays === 1 ? 'No check-in was logged today' : 'No check-in was logged this week',
      raisedVia: 'system',
      dedupeKey: `missed_checkin:${parent.id}:${today}`,
    });
  }
}

const NEAR_TRIAL_END_MS = 24 * 60 * 60 * 1000;

export async function remindTrialEnding(now = new Date()) {
  const ending = await Subscription.find({
    status: 'trial',
    trialEndsAt: { $gt: now, $lte: new Date(now.getTime() + NEAR_TRIAL_END_MS) },
  }).populate('planId', 'name');

  for (const subscription of ending) {
    await notify(subscription.customerId, {
      title: 'Your free trial ends soon',
      body: `Your ${subscription.planId?.name ?? ''} plan starts charging within a day.`,
      link: '/billing',
      dedupeKey: `trial_ending:${subscription.id}`,
    });
  }
}

export async function expireUnansweredBookings(now = new Date()) {
  const overdue = await Booking.find({ status: 'REQUESTED', scheduledAt: { $lte: now } });
  for (const booking of overdue) await expireBooking(booking);
}

function runSafely(task) {
  return () => task().catch((err) => console.error(`${task.name} failed:`, err));
}

// Every task is safe to repeat, so a failed or skipped run is covered by the next one.
export function startCareJobs() {
  cron.schedule('*/30 * * * * *', runSafely(escalateUnansweredSos));

  const quarterHourly = [
    sendMedicineReminders,
    flagMissedMedicines,
    flagMissedCheckIns,
    remindTrialEnding,
    expireUnansweredBookings,
  ];
  cron.schedule('*/15 * * * *', () => quarterHourly.forEach((task) => runSafely(task)()));
}
