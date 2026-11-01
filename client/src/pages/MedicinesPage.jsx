import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { api, getErrorMessage } from '../api/client';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import LoadError from '../components/LoadError';
import Loading from '../components/Loading';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { useForm } from '../hooks/useForm';
import { usePageTitle } from '../hooks/usePageTitle';
import { indiaDate } from '../utils/format';
import { compact } from '../utils/validators';

function MedicineForm({ parentId, medicine, onSaved, onCancel }) {
  const [today] = useState(() => indiaDate());

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      name: medicine?.name ?? '',
      dose: medicine?.dose ?? '',
      times: medicine?.times ?? ['08:00'],
      startDate: medicine?.startDate ?? today,
      endDate: medicine?.endDate ?? '',
    },
    validate: (form) =>
      compact({
        name: form.name.trim().length < 2 ? 'Enter the medicine name' : undefined,
        dose: form.dose.trim() ? undefined : 'Enter the dose',
        times:
          form.times.length === 0
            ? 'Add at least one time'
            : new Set(form.times).size !== form.times.length
              ? 'Each time can only appear once'
              : undefined,
        startDate: form.startDate ? undefined : 'Choose a start date',
        endDate:
          form.endDate && form.endDate < form.startDate
            ? 'The end date must be after the start date'
            : undefined,
      }),
    onSubmit: async (form) => {
      const body = { ...form, endDate: form.endDate || null };
      if (medicine) await api.put(`/parents/${parentId}/medicines/${medicine.id}`, body);
      else await api.post(`/parents/${parentId}/medicines`, body);
      onSaved();
    },
  });

  const setTime = (index, time) =>
    setValue(
      'times',
      values.times.map((current, position) => (position === index ? time : current)),
    );

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 space-y-4 rounded-2xl border border-line bg-white p-5"
    >
      <FormAlert>{formError}</FormAlert>
      <FormField label="Medicine name" autoComplete="off" {...field('name')} />
      <FormField label="Dose" hint="For example, 500 mg after food" autoComplete="off" {...field('dose')} />

      <fieldset>
        <legend className="font-semibold">Times each day (India time)</legend>
        <ul className="mt-2 space-y-2">
          {values.times.map((time, index) => (
            <li key={index} className="flex items-center gap-2">
              <input
                type="time"
                aria-label={`Dose time ${index + 1}`}
                value={time}
                onChange={(event) => setTime(index, event.target.value)}
                className="min-h-12 rounded-xl border-2 border-line bg-white px-3 py-2"
              />
              <button
                type="button"
                onClick={() =>
                  setValue(
                    'times',
                    values.times.filter((_, position) => position !== index),
                  )
                }
                aria-label={`Remove dose time ${index + 1}`}
                className="grid size-11 place-items-center rounded-lg text-danger"
              >
                <X aria-hidden="true" size={22} />
              </button>
            </li>
          ))}
        </ul>
        {values.times.length < 6 && (
          <button
            type="button"
            onClick={() => setValue('times', [...values.times, '20:00'])}
            className="btn btn-secondary mt-2"
          >
            <Plus aria-hidden="true" size={20} />
            Add a time
          </button>
        )}
        {errors.times && <p className="mt-1.5 text-base font-medium text-danger">{errors.times}</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start date" type="date" {...field('startDate')} />
        <FormField label="End date (optional)" type="date" {...field('endDate')} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Saving…' : 'Save medicine'}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

const DOSE_LABELS = { given: 'Given', missed: 'Missed' };

function MedicineCard({ parentId, medicine, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  if (editing) {
    return (
      <li>
        <MedicineForm
          parentId={parentId}
          medicine={medicine}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      </li>
    );
  }

  const stop = async () => {
    setError('');
    try {
      await api.post(`/parents/${parentId}/medicines/${medicine.id}/stop`);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-sans text-xl font-semibold">{medicine.name}</h3>
      <p>{medicine.dose}</p>
      <p className="text-ink-soft">
        {medicine.times.join(', ')} India time, from {medicine.startDate}
        {medicine.endDate ? ` to ${medicine.endDate}` : ''}
        {medicine.stopped ? '. Stopped.' : ''}
      </p>
      {medicine.todayDoses.length > 0 && (
        <ul className="mt-2">
          {medicine.todayDoses.map(({ time, status }) => (
            <li key={time}>
              Today at {time}: <strong>{DOSE_LABELS[status] ?? 'Not logged yet'}</strong>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <FormAlert>{error}</FormAlert>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {!medicine.stopped && (
          <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary">
            Edit
          </button>
        )}
        {medicine.activeToday && (
          <button type="button" onClick={stop} className="btn text-danger underline">
            Stop this medicine
          </button>
        )}
      </div>
    </li>
  );
}

export default function MedicinesPage() {
  usePageTitle('Medicines');
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi(`/parents/${id}/medicines`);
  const [adding, setAdding] = useState(false);
  const backLink =
    user.role === 'caregiver'
      ? { to: '/caregiver', label: 'Back to today' }
      : { to: '/parents', label: 'Back to My Parents' };

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const current = data.medicines.filter(({ activeToday }) => activeToday);
    const other = data.medicines.filter(({ activeToday }) => !activeToday);

    return (
      <>
        <h1 className="mt-2 text-4xl">{data.parent.name}'s medicines</h1>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-primary mt-4">
            <Plus aria-hidden="true" size={20} />
            Add a medicine
          </button>
        )}
        {adding && (
          <MedicineForm
            parentId={id}
            onCancel={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              reload();
            }}
          />
        )}

        {data.medicines.length === 0 && (
          <p className="mt-4 text-ink-soft">No medicines have been added yet.</p>
        )}
        {current.length > 0 && (
          <ul className="mt-6 space-y-4">
            {current.map((medicine) => (
              <MedicineCard key={medicine.id} parentId={id} medicine={medicine} onChanged={reload} />
            ))}
          </ul>
        )}
        {other.length > 0 && (
          <>
            <h2 className="mt-10 text-2xl">Not active today</h2>
            <ul className="mt-3 space-y-4">
              {other.map((medicine) => (
                <MedicineCard key={medicine.id} parentId={id} medicine={medicine} onChanged={reload} />
              ))}
            </ul>
          </>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link to={backLink.to} className="text-link">
        {backLink.label}
      </Link>
      {content()}
    </div>
  );
}
