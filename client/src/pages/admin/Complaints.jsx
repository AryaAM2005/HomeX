import { useState } from 'react';
import { api, getErrorMessage, getFieldErrors } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import Toggle from '../../components/Toggle';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDateTime } from '../../utils/format';

const VIEW_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

function ResolveForm({ complaint, onDone }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary mt-3">
        Resolve
      </button>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldError('');
    try {
      await api.patch(`/admin/complaints/${complaint.id}`, { resolution });
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.resolution) setFieldError(fields.resolution);
      else setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-3 rounded-xl bg-sand p-4">
      <FormAlert>{error}</FormAlert>
      <FormTextarea
        label="How was this resolved?"
        hint="The family sees this."
        rows={3}
        name="resolution"
        value={resolution}
        error={fieldError}
        onChange={(event) => setResolution(event.target.value)}
      />
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className="btn btn-primary">
          Mark resolved
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Go back
        </button>
      </div>
    </form>
  );
}

function ComplaintCard({ complaint, onChanged }) {
  const { customer, booking } = complaint;

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <p className="text-ink-soft">{formatDateTime(complaint.createdAt)}</p>
      <p className="mt-1 text-xl">{complaint.message}</p>
      {customer && (
        <p className="mt-2">
          <span className="text-ink-soft">From:</span> {customer.name},{' '}
          <a href={`tel:${customer.phone}`} className="text-link whitespace-nowrap">
            {customer.phone}
          </a>
        </p>
      )}
      {booking && (
        <p>
          <span className="text-ink-soft">Booking:</span> {booking.label},{' '}
          {formatDateTime(booking.scheduledAt)}, with {booking.caregiverName}
        </p>
      )}
      {complaint.resolution && (
        <p className="mt-2 rounded-xl bg-sand px-4 py-3">
          <strong>Resolved:</strong> {complaint.resolution}
        </p>
      )}
      {complaint.status === 'open' && <ResolveForm complaint={complaint} onDone={onChanged} />}
    </li>
  );
}

export default function AdminComplaints() {
  usePageTitle('Complaints');
  const [view, setView] = useState('open');
  const { data, loading, error, reload } = useApi(`/admin/complaints?status=${view}`);

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.complaints.length === 0) {
      return <p className="mt-6 text-ink-soft">Nothing here.</p>;
    }

    return (
      <ul className="mt-6 space-y-4">
        {data.complaints.map((complaint) => (
          <ComplaintCard key={complaint.id} complaint={complaint} onChanged={reload} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Complaints</h1>
      <div className="mt-6">
        <Toggle legend="Show complaints" value={view} onChange={setView} options={VIEW_OPTIONS} />
      </div>
      {list()}
    </div>
  );
}
