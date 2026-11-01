import { Paperclip, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { compact } from '../../utils/validators';

const MAX_FILES = 5;

const VITAL_FIELDS = [
  { name: 'bpSystolic', label: 'BP, upper number (mmHg)' },
  { name: 'bpDiastolic', label: 'BP, lower number (mmHg)' },
  { name: 'sugar', label: 'Blood sugar (mg/dL)' },
  { name: 'pulse', label: 'Pulse (bpm)' },
  { name: 'temperature', label: 'Temperature (°F)' },
];

function ReportForm({ booking }) {
  const navigate = useNavigate();

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      doctorName: '',
      hospital: '',
      diagnosisSummary: '',
      prescriptions: '',
      nextFollowUp: '',
      notes: '',
      files: [],
      ...Object.fromEntries(VITAL_FIELDS.map(({ name }) => [`vitals.${name}`, ''])),
    },
    validate: (form) =>
      compact({
        doctorName: form.doctorName.trim().length < 2 ? 'Enter the doctor or lab name' : undefined,
        diagnosisSummary:
          form.diagnosisSummary.trim().length < 10 ? 'Write what the doctor or lab said' : undefined,
        ...Object.fromEntries(
          VITAL_FIELDS.filter(({ name }) => {
            const text = form[`vitals.${name}`].trim();
            return text && !Number.isFinite(Number(text));
          }).map(({ name }) => [`vitals.${name}`, 'Enter a number']),
        ),
      }),
    onSubmit: async (form) => {
      const vitals = Object.fromEntries(
        VITAL_FIELDS.filter(({ name }) => form[`vitals.${name}`].trim()).map(({ name }) => [
          name,
          Number(form[`vitals.${name}`]),
        ]),
      );

      const body = new FormData();
      body.append(
        'data',
        JSON.stringify({
          doctorName: form.doctorName,
          hospital: form.hospital,
          diagnosisSummary: form.diagnosisSummary,
          vitals,
          prescriptions: form.prescriptions,
          nextFollowUp: form.nextFollowUp || undefined,
          notes: form.notes,
        }),
      );
      form.files.forEach((file) => body.append('attachments', file));

      await api.post(`/bookings/${booking.id}/report`, body);
      navigate('/caregiver/bookings', {
        state: { notice: `Care report sent to ${booking.parent.name}'s family.` },
      });
    },
  });

  const addFiles = (event) => {
    const chosen = [...event.target.files];
    event.target.value = '';
    setValue('files', [...values.files, ...chosen].slice(0, MAX_FILES));
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
      <FormAlert>{formError}</FormAlert>
      <FormField label="Doctor or lab" autoComplete="off" {...field('doctorName')} />
      <FormField label="Hospital or clinic (optional)" autoComplete="off" {...field('hospital')} />
      <FormTextarea label="What did the doctor or lab say?" {...field('diagnosisSummary')} />

      <fieldset>
        <legend className="font-semibold">Vitals (leave blank if not taken)</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          {VITAL_FIELDS.map(({ name, label }) => (
            <FormField
              key={name}
              label={label}
              inputMode="decimal"
              autoComplete="off"
              {...field(`vitals.${name}`)}
            />
          ))}
        </div>
      </fieldset>

      <FormTextarea label="Prescriptions (optional)" rows={3} {...field('prescriptions')} />
      <FormField label="Next follow-up (optional)" type="date" {...field('nextFollowUp')} />
      <FormTextarea label="Notes (optional)" rows={3} {...field('notes')} />

      <div>
        <p className="font-semibold">Photos of prescriptions or lab reports (optional)</p>
        <p className="text-base text-ink-soft">PDF, JPG or PNG, up to 5 MB each.</p>
        {values.files.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {values.files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 py-1">
                <span className="min-w-0 break-all">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() =>
                    setValue(
                      'files',
                      values.files.filter((_, position) => position !== index),
                    )
                  }
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-danger"
                >
                  <X aria-hidden="true" size={22} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {values.files.length < MAX_FILES && (
          <label className="btn btn-secondary mt-2 cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay">
            <Paperclip aria-hidden="true" size={20} />
            Add a file
            <input
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={addFiles}
            />
          </label>
        )}
        {errors.files && <p className="mt-1.5 text-base font-medium text-danger">{errors.files}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? 'Sending…' : 'Send report'}
        </button>
        <Link to="/caregiver/bookings" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function SubmitReport() {
  usePageTitle('Submit care report');
  const { id } = useParams();
  const { data, loading, error, reload } = useApi('/bookings');
  const booking = data?.bookings.find((candidate) => candidate.id === id);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (!booking || booking.status !== 'COMPLETED') {
      return <p className="mt-4 text-ink-soft">This booking is not waiting for a report.</p>;
    }

    return (
      <>
        <p className="mt-2 text-ink-soft">
          {booking.label} for {booking.parent.name}.
        </p>
        <ReportForm booking={booking} />
      </>
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Submit care report</h1>
      {content()}
    </div>
  );
}
