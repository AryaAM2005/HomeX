import { useState } from 'react';
import { api, getErrorMessage } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/format';

function RequestCard({ request, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const respond = async (action) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/caregivers/me/requests/${request.id}`, { action });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <h3 className="text-2xl">
        {request.parentName}
        {request.age && <span className="font-sans text-lg text-ink-soft">, {request.age}</span>}
      </h3>
      <p className="text-ink-soft">
        Requested by {request.familyName} on {formatDate(request.date)}
        {request.distanceKm !== null && `, ${request.distanceKm} km from your area`}.
      </p>
      <p className="mt-1 text-ink-soft">
        You will see the home address and health details once you accept.
      </p>
      <div className="mt-3">
        <FormAlert>{error}</FormAlert>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => respond('accept')}
          className="btn btn-primary"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond('decline')}
          className="btn btn-secondary"
        >
          Decline
        </button>
      </div>
    </li>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-base text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function FamilyCard({ family }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <h3 className="text-2xl">
        {family.name}
        {family.age && <span className="font-sans text-lg text-ink-soft">, {family.age}</span>}
      </h3>
      <p className="font-medium">
        {family.role === 'primary' ? 'You are the primary caregiver' : 'You are the backup caregiver'}
      </p>
      <dl className="mt-3 space-y-2">
        <Detail label="Address">{family.address || 'Not added yet'}</Detail>
        <Detail label="Health conditions">{family.conditions.join(', ') || 'None listed'}</Detail>
        <Detail label="Allergies">{family.allergies.join(', ') || 'None listed'}</Detail>
        <Detail label="Family contact">
          {family.family.name}{' '}
          <a href={`tel:${family.family.phone}`} className="text-link whitespace-nowrap">
            {family.family.phone}
          </a>
        </Detail>
        {family.emergencyContact && (
          <Detail label="Emergency contact">
            {family.emergencyContact.name}{' '}
            <a href={`tel:${family.emergencyContact.phone}`} className="text-link whitespace-nowrap">
              {family.emergencyContact.phone}
            </a>
          </Detail>
        )}
      </dl>
    </li>
  );
}

export default function CaregiverRequests() {
  usePageTitle('Families');
  const { data, loading, error, reload } = useApi('/caregivers/me/requests');

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    return (
      <>
        <h2 className="mt-6 text-3xl">Families asking for you</h2>
        {data.requests.length === 0 ? (
          <p className="mt-2 text-ink-soft">No requests right now.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {data.requests.map((request) => (
              <RequestCard key={request.id} request={request} onChanged={reload} />
            ))}
          </ul>
        )}

        <h2 className="mt-10 text-3xl">Families in your care</h2>
        {data.families.length === 0 ? (
          <p className="mt-2 text-ink-soft">Families appear here once you accept a request.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {data.families.map((family) => (
              <FamilyCard key={family.id} family={family} />
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Families</h1>
      {content()}
    </div>
  );
}
