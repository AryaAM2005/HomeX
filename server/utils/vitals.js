// Safety-net limits for raising an alert, not medical advice. Have a clinician
// review these before real use.
const LIMITS = [
  { key: 'bpSystolic', label: 'Systolic BP', low: 90, high: 160, unit: 'mmHg' },
  { key: 'bpDiastolic', label: 'Diastolic BP', low: 50, high: 100, unit: 'mmHg' },
  { key: 'sugar', label: 'Blood sugar', low: 70, high: 250, unit: 'mg/dL' },
  { key: 'temperature', label: 'Temperature', low: 95, high: 101, unit: '°F' },
  { key: 'pulse', label: 'Pulse', low: 45, high: 120, unit: 'bpm' },
];

export function findAbnormalVitals(vitals = {}) {
  return LIMITS.filter(({ key, low, high }) => {
    const value = vitals[key];
    return value !== undefined && value !== null && (value <= low || value >= high);
  }).map(({ key, label, unit }) => `${label} ${vitals[key]} ${unit}`);
}
