import { useState } from 'react';
import { api } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { MapPicker } from '../../components/Maps';
import { WEEKDAYS } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { compact } from '../../utils/validators';

const TIME_INPUT = 'min-h-12 rounded-xl border-2 border-line bg-white px-3 py-2';

function toSchedule(availability) {
  return Object.fromEntries(
    WEEKDAYS.map(({ value }) => {
      const slot = availability.find(({ day }) => day === value);
      return [value, { on: Boolean(slot), start: slot?.start ?? '09:00', end: slot?.end ?? '18:00' }];
    }),
  );
}

function AvailabilityForm({ profile, onSaved }) {
  const [saved, setSaved] = useState(false);

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      area: profile.area,
      location: profile.location,
      serviceRadiusKm: String(profile.serviceRadiusKm),
      schedule: toSchedule(profile.availability),
    },
    validate: (form) => {
      const openDays = Object.values(form.schedule).filter(({ on }) => on);

      return compact({
        area: form.area.trim().length < 2 ? 'Enter your area' : undefined,
        location: form.location ? undefined : 'Place a pin on the map',
        schedule:
          openDays.length === 0
            ? 'Choose at least one day'
            : openDays.some(({ start, end }) => start >= end)
              ? 'Each end time must be after its start time'
              : undefined,
      });
    },
    onSubmit: async (form) => {
      setSaved(false);
      await api.put('/caregivers/me', {
        area: form.area,
        location: form.location,
        serviceRadiusKm: Number(form.serviceRadiusKm),
        availability: WEEKDAYS.filter(({ value }) => form.schedule[value].on).map(({ value }) => ({
          day: value,
          start: form.schedule[value].start,
          end: form.schedule[value].end,
        })),
      });
      setSaved(true);
      onSaved();
    },
  });

  const setDay = (day, change) => {
    setValue('schedule', { ...values.schedule, [day]: { ...values.schedule[day], ...change } });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
      <FormAlert>{formError}</FormAlert>
      <FormField label="Your area" hint="For example, Saheed Nagar" {...field('area')} />
      <MapPicker
        label="The centre of your service area"
        hint="This can be a nearby landmark. Families see a location rounded to about 100 metres."
        value={values.location}
        error={errors.location}
        onChange={(location) => setValue('location', location)}
      />
      <div>
        <label htmlFor="serviceRadiusKm" className="block font-semibold">
          How far will you travel?
        </label>
        <select
          id="serviceRadiusKm"
          value={values.serviceRadiusKm}
          onChange={(event) => setValue('serviceRadiusKm', event.target.value)}
          className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2"
        >
          {[3, 5, 10, 15, 25, 50].map((km) => (
            <option key={km} value={km}>
              {km} km
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="font-semibold">Weekly availability</legend>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {WEEKDAYS.map(({ value, label }) => {
            const day = values.schedule[value];

            return (
              <li key={value} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <label className="flex w-36 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={day.on}
                    onChange={(event) => setDay(value, { on: event.target.checked })}
                    className="size-5 accent-clay"
                  />
                  {label}
                </label>
                {day.on && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${label} start time`}
                      value={day.start}
                      onChange={(event) => setDay(value, { start: event.target.value })}
                      className={TIME_INPUT}
                    />
                    <span>to</span>
                    <input
                      type="time"
                      aria-label={`${label} end time`}
                      value={day.end}
                      onChange={(event) => setDay(value, { end: event.target.value })}
                      className={TIME_INPUT}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {errors.schedule && (
          <p role="alert" className="mt-1.5 text-base font-medium text-danger">
            {errors.schedule}
          </p>
        )}
      </fieldset>

      <FormAlert tone="success">{saved ? 'Your availability has been saved.' : ''}</FormAlert>
      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'Saving…' : 'Save availability'}
      </button>
    </form>
  );
}

export default function CaregiverAvailability() {
  usePageTitle('Availability');
  const { data, loading, error, reload } = useApi('/caregivers/me');

  const content = () => {
    if (loading && !data) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    return <AvailabilityForm profile={data.profile} onSaved={reload} />;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Availability &amp; Service Area</h1>
      {content()}
    </div>
  );
}
