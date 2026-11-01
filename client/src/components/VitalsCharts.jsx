import { lazy, Suspense } from 'react';
import { formatDateTime } from '../utils/format';
import Loading from './Loading';

// Recharts is large, so it only loads on the page that shows charts.
const VitalsChart = lazy(() => import('./VitalsChart'));

const CHARTS = [
  {
    title: 'Blood pressure',
    unit: 'mmHg',
    series: [
      { key: 'bpSystolic', label: 'Systolic' },
      { key: 'bpDiastolic', label: 'Diastolic' },
    ],
  },
  { title: 'Blood sugar', unit: 'mg/dL', series: [{ key: 'sugar', label: 'Blood sugar' }] },
  { title: 'Pulse', unit: 'bpm', series: [{ key: 'pulse', label: 'Pulse' }] },
  { title: 'Temperature', unit: '°F', series: [{ key: 'temperature', label: 'Temperature' }] },
];

const shortDay = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

function rowsFor(chart, readings) {
  return readings
    .filter(({ vitals }) => chart.series.some(({ key }) => vitals[key] != null))
    .toReversed()
    .map(({ time, vitals }, index) => ({
      ...vitals,
      index,
      day: shortDay.format(new Date(time)),
      label: formatDateTime(time),
    }));
}

export default function VitalsCharts({ readings }) {
  const charts = CHARTS.map((chart) => ({ ...chart, rows: rowsFor(chart, readings) })).filter(
    ({ rows }) => rows.length > 0,
  );

  if (charts.length === 0) {
    return <p className="mt-2 text-ink-soft">No vitals in the last 30 days.</p>;
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {charts.map((chart) => (
          <VitalsChart key={chart.title} {...chart} />
        ))}
      </div>
    </Suspense>
  );
}
