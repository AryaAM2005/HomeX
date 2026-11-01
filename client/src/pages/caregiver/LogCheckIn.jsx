import { useState } from 'react';
import { Camera, LocateFixed } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import Toggle from '../../components/Toggle';
import { MOODS } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { shrinkImage } from '../../utils/shrinkImage';
import { compact } from '../../utils/validators';

const TYPE_OPTIONS = [
  { value: 'visit', label: 'Home visit' },
  { value: 'call', label: 'Phone call' },
];

const VITAL_FIELDS = [
  { name: 'bpSystolic', label: 'BP, upper number', unit: 'mmHg', min: 50, max: 260 },
  { name: 'bpDiastolic', label: 'BP, lower number', unit: 'mmHg', min: 30, max: 160 },
  { name: 'sugar', label: 'Blood sugar', unit: 'mg/dL', min: 20, max: 700 },
  { name: 'pulse', label: 'Pulse', unit: 'bpm', min: 20, max: 220 },
  { name: 'temperature', label: 'Temperature', unit: '°F', min: 90, max: 110 },
];

const DOSE_OPTIONS = [
  { value: 'given', label: 'Given' },
  { value: 'missed', label: 'Missed' },
  { value: 'later', label: 'Not yet' },
];

const doseKey = ({ medicineId, time }) => `${medicineId}|${time}`;

function vitalsError(form) {
  const errors = {};

  for (const { name, label, min, max } of VITAL_FIELDS) {
    const text = form[`vitals.${name}`].trim();
    const value = Number(text);
    if (text && (!Number.isFinite(value) || value < min || value > max)) {
      errors[`vitals.${name}`] = `Check the ${label.toLowerCase()}`;
    }
  }

  const hasUpper = form['vitals.bpSystolic'].trim();
  const hasLower = form['vitals.bpDiastolic'].trim();
  if (hasUpper && !hasLower) errors['vitals.bpDiastolic'] = 'Enter both blood pressure numbers';
  if (hasLower && !hasUpper) errors['vitals.bpSystolic'] = 'Enter both blood pressure numbers';

  return errors;
}

function DoseRow({ dose, value, onChange }) {
  return (
    <li className="py-3">
      <fieldset>
        <legend>
          <strong>{dose.name}</strong>, {dose.dose}, at {dose.time}
        </legend>
        <div className="mt-2">
          <Toggle
            legend={`${dose.name} at ${dose.time}`}
            value={value}
            onChange={onChange}
            options={DOSE_OPTIONS}
          />
        </div>
      </fieldset>
    </li>
  );
}

function CheckInForm({ visit }) {
  const navigate = useNavigate();
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const waitingDoses = visit.doses.filter(({ status }) => status === null);

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      type: 'visit',
      location: null,
      photo: null,
      mood: '',
      doses: {},
      notes: '',
      ...Object.fromEntries(VITAL_FIELDS.map(({ name }) => [`vitals.${name}`, ''])),
    },
    validate: (form) =>
      compact({
        location: form.type === 'visit' && !form.location ? 'Share your location' : undefined,
        photo: form.type === 'visit' && !form.photo ? 'Add a photo' : undefined,
        mood: form.mood ? undefined : 'Choose how they seem today',
        ...vitalsError(form),
      }),
    onSubmit: async (form) => {
      const vitals = Object.fromEntries(
        VITAL_FIELDS.filter(({ name }) => form[`vitals.${name}`].trim()).map(({ name }) => [
          name,
          Number(form[`vitals.${name}`]),
        ]),
      );
      const medicines = waitingDoses
        .map((dose) => ({ ...dose, status: form.doses[doseKey(dose)] }))
        .filter(({ status }) => status === 'given' || status === 'missed')
        .map(({ medicineId, time, status }) => ({ medicineId, time, status }));

      const body = new FormData();
      body.append(
        'data',
        JSON.stringify({
          parentId: visit.id,
          type: form.type,
          location: form.type === 'visit' ? form.location : undefined,
          mood: form.mood,
          vitals,
          medicines,
          notes: form.notes,
        }),
      );
      if (form.type === 'visit') body.append('photo', await shrinkImage(form.photo));

      const res = await api.post('/checkins', body);
      const { abnormalVitals } = res.data;

      navigate('/caregiver', {
        state: {
          notice:
            abnormalVitals.length > 0
              ? `Check-in saved. ${abnormalVitals.join(', ')} looks unusual, so the family and care manager have been alerted.`
              : `Check-in saved for ${visit.name}.`,
        },
      });
    },
  });

  const shareLocation = () => {
    setLocateError('');
    if (!navigator.geolocation) {
      setLocateError('This phone cannot share its location. Log a phone call instead.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setValue('location', { lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setLocating(false);
        setLocateError('We could not get your location. Turn on location and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
      <FormAlert>{formError}</FormAlert>

      <Toggle
        legend="Type of check-in"
        value={values.type}
        onChange={(type) => setValue('type', type)}
        options={TYPE_OPTIONS}
      />

      {values.type === 'visit' && (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="font-semibold">Your location</p>
            <button
              type="button"
              onClick={shareLocation}
              disabled={locating}
              className="btn btn-secondary mt-2"
            >
              <LocateFixed aria-hidden="true" size={20} />
              {locating && 'Finding you…'}
              {!locating && (values.location ? 'Location saved. Update' : 'Share my location')}
            </button>
            {(errors.location || locateError) && (
              <p className="mt-1.5 text-base font-medium text-danger">
                {locateError || errors.location}
              </p>
            )}
          </div>

          <div>
            <p className="font-semibold">Photo</p>
            <label className="btn btn-secondary mt-2 cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay">
              <Camera aria-hidden="true" size={20} />
              {values.photo ? 'Change photo' : 'Take a photo'}
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                className="sr-only"
                onChange={(event) => setValue('photo', event.target.files[0] ?? null)}
              />
            </label>
            {values.photo && <p className="mt-1 break-all text-ink-soft">{values.photo.name}</p>}
            {errors.photo && (
              <p className="mt-1.5 text-base font-medium text-danger">{errors.photo}</p>
            )}
          </div>
        </div>
      )}

      <fieldset>
        <legend className="font-semibold">How do they seem today?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOODS.map(({ value, label }) => (
            <label
              key={value}
              className={`cursor-pointer rounded-xl border-2 px-4 py-2 font-medium has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay ${
                values.mood === value ? 'border-ink bg-ink text-cream' : 'border-line bg-white'
              }`}
            >
              <input
                type="radio"
                name="mood"
                value={value}
                checked={values.mood === value}
                onChange={() => setValue('mood', value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        {errors.mood && <p className="mt-1.5 text-base font-medium text-danger">{errors.mood}</p>}
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-semibold">Vitals (leave blank if not taken)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {VITAL_FIELDS.map(({ name, label, unit }) => (
            <FormField
              key={name}
              label={`${label} (${unit})`}
              inputMode="decimal"
              autoComplete="off"
              {...field(`vitals.${name}`)}
            />
          ))}
        </div>
      </fieldset>

      {waitingDoses.length > 0 && (
        <section>
          <h2 className="font-sans text-lg font-semibold">Today's medicines</h2>
          <ul className="divide-y divide-line">
            {waitingDoses.map((dose) => (
              <DoseRow
                key={doseKey(dose)}
                dose={dose}
                value={values.doses[doseKey(dose)] ?? 'later'}
                onChange={(status) =>
                  setValue('doses', { ...values.doses, [doseKey(dose)]: status })
                }
              />
            ))}
          </ul>
        </section>
      )}

      <FormTextarea label="Notes (optional)" rows={3} {...field('notes')} />

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Saving…' : 'Save check-in'}
        </button>
        <Link to="/caregiver" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function LogCheckIn() {
  usePageTitle('Log check-in');
  const { id } = useParams();
  const { data, loading, error, reload } = useApi('/checkins/today');
  const visit = data?.visits.find((candidate) => candidate.id === id);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (!visit) return <p className="mt-4 text-ink-soft">This parent is not in your care.</p>;

    return (
      <>
        <h1 className="text-4xl">Check-in for {visit.name}</h1>
        <CheckInForm visit={visit} />
      </>
    );
  };

  return <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">{content()}</div>;
}
