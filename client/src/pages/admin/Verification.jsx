import { useState } from 'react';
import { Link } from 'react-router';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import Toggle from '../../components/Toggle';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/format';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminVerification() {
  usePageTitle('Caregiver Verification');
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useApi(`/admin/caregivers?status=${status}`);

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.caregivers.length === 0) return <p className="mt-4 text-ink-soft">Nobody here.</p>;

    return (
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {data.caregivers.map((caregiver) => (
          <li key={caregiver.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-semibold">{caregiver.name}</p>
              <p className="break-all text-ink-soft">{caregiver.email}</p>
              <p className="text-ink-soft">
                {caregiver.area || 'No area yet'}, {caregiver.documentCount} documents
                {caregiver.submittedAt && `, submitted ${formatDate(caregiver.submittedAt)}`}
              </p>
            </div>
            <Link to={`/admin/caregivers/${caregiver.id}`} className="btn btn-secondary">
              Review
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Caregiver Verification</h1>
      <p className="mt-2 text-ink-soft">Only approved caregivers appear to families.</p>
      <div className="mt-6">
        <Toggle legend="Show caregivers" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
      </div>
      {list()}
    </div>
  );
}
