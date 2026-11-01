import { Alert } from '../models/Alert.js';
import { CheckIn } from '../models/CheckIn.js';
import { WellnessReport } from '../models/WellnessReport.js';
import { notify } from './notifications.js';
import { addDays, startOfIstDay } from './time.js';

const MEASURES = ['bpSystolic', 'bpDiastolic', 'sugar', 'temperature', 'pulse'];
const ONE_DECIMAL = 10;

const roundTo = (value) => Math.round(value * ONE_DECIMAL) / ONE_DECIMAL;

function average(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function readings(checkIns, measure) {
  return checkIns.map(({ vitals }) => vitals?.[measure]).filter((value) => value != null);
}

function buildTrend(checkIns, previousCheckIns) {
  const trend = {};

  for (const measure of MEASURES) {
    const values = readings(checkIns, measure);
    if (values.length === 0) continue;

    const previous = readings(previousCheckIns, measure);
    const avg = roundTo(average(values));
    trend[measure] = {
      avg,
      min: Math.min(...values),
      max: Math.max(...values),
      change: previous.length > 0 ? roundTo(avg - average(previous)) : null,
    };
  }
  return trend;
}

function adherence(checkIns) {
  const doses = checkIns.flatMap(({ medicinesGiven }) => medicinesGiven);
  if (doses.length === 0) return null;

  return Math.round((doses.filter(({ status }) => status === 'given').length / doses.length) * 100);
}

function commonMood(checkIns) {
  const counts = new Map();
  checkIns.forEach(({ mood }) => counts.set(mood, (counts.get(mood) ?? 0) + 1));
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function buildSummary({ firstName, checkinCount, expected, mood, adherencePct, trend, alertCount }) {
  const parts = [`${firstName} had ${checkinCount} of ${expected} expected check-ins this week.`];

  if (mood) parts.push(`Mood was mostly ${mood}.`);
  if (adherencePct !== null) parts.push(`${adherencePct}% of logged medicine doses were given.`);
  if (trend.bpSystolic && trend.bpDiastolic) {
    parts.push(
      `Average blood pressure was ${Math.round(trend.bpSystolic.avg)}/${Math.round(trend.bpDiastolic.avg)}.`,
    );
  }
  if (trend.sugar) parts.push(`Average blood sugar was ${Math.round(trend.sugar.avg)}.`);

  parts.push(
    alertCount === 0
      ? 'There were no alerts.'
      : `${alertCount} ${alertCount === 1 ? 'alert was' : 'alerts were'} raised.`,
  );
  return parts.join(' ');
}

// Saves one parent's report for the week starting on the given Monday.
// Returns the report, or null if that week already has one.
export async function createWellnessReport({ parent, plan, weekStart, replace = false }) {
  const weekEnd = addDays(weekStart, 6);
  const dateRange = (from, to) => ({ $gte: from, $lte: to });

  const [checkIns, previousCheckIns, alertCount] = await Promise.all([
    CheckIn.find({ parentId: parent.id, date: dateRange(weekStart, weekEnd) }),
    CheckIn.find({
      parentId: parent.id,
      date: dateRange(addDays(weekStart, -7), addDays(weekStart, -1)),
    }),
    Alert.countDocuments({
      parentId: parent.id,
      createdAt: {
        $gte: startOfIstDay(weekStart),
        $lt: startOfIstDay(addDays(weekStart, 7)),
      },
    }),
  ]);

  const vitalsTrend = buildTrend(checkIns, previousCheckIns);
  const adherencePct = adherence(checkIns);

  const report = {
    parentId: parent.id,
    weekStart,
    weekEnd,
    summary: buildSummary({
      firstName: parent.name.split(' ')[0],
      checkinCount: checkIns.length,
      expected: plan.checkinsPerWeek,
      mood: commonMood(checkIns),
      adherencePct,
      trend: vitalsTrend,
      alertCount,
    }),
    vitalsTrend,
    adherencePct: adherencePct ?? undefined,
    checkinCount: checkIns.length,
    expectedCheckins: plan.checkinsPerWeek,
    alertCount,
  };

  if (replace) {
    return WellnessReport.findOneAndReplace({ parentId: parent.id, weekStart }, report, {
      upsert: true,
      returnDocument: 'after',
    });
  }

  try {
    const created = await WellnessReport.create(report);
    await notify(parent.customerId, {
      title: 'Weekly wellness report',
      body: `${parent.name}'s report for the week of ${weekStart} is ready.`,
      link: `/parents/${parent.id}/reports`,
    });
    return created;
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}
