import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api, getErrorMessage } from '../../api/client';
import { useLiveEvents } from '../../api/live';
import CheckInSummary from '../../components/CheckInSummary';
import FormAlert from '../../components/FormAlert';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import ParentSosLink from '../../components/ParentSosLink';
import ReviewForm from '../../components/ReviewForm';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';

function PersonLine({ label, person }) {
  return (
    <p>
      <span className="text-ink-soft">{label}:</span> <strong>{person.name}</strong>{' '}
      <a href={`tel:${person.phone}`} className="text-link whitespace-nowrap">
        {person.phone}
      </a>
    </p>
  );
}

function CaregiverSection({ parent, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const chooseLink = (
    <Link to={`/parents/${parent.id}/caregivers`} className="btn btn-primary">
      Choose a caregiver
    </Link>
  );

  const cancelRequest = async () => {
    setBusy(true);
    onError('');
    try {
      await api.delete(`/parents/${parent.id}/assign`);
      onChanged();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!parent.profileComplete) {
    return (
      <p className="mt-3 rounded-xl bg-sand px-4 py-3">
        Add {parent.name}'s address and map pin to choose a caregiver.
      </p>
    );
  }

  if (!parent.hasActivePlan) {
    return (
      <div className="mt-3 rounded-xl bg-sand px-4 py-3">
        <p>Start a plan for {parent.name} to choose a caregiver.</p>
        <Link to="/plans" className="text-link">
          See plans
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {parent.request?.status === 'pending' && (
        <div className="rounded-xl bg-sand px-4 py-3">
          <p>Waiting for {parent.request.caregiverName} to accept.</p>
          <button type="button" disabled={busy} onClick={cancelRequest} className="text-link">
            Cancel this request
          </button>
        </div>
      )}
      {parent.request?.status === 'declined' && (
        <p className="rounded-xl bg-sand px-4 py-3">
          {parent.request.caregiverName} could not take this on. Please choose someone else.
        </p>
      )}
      {parent.request?.status !== 'pending' && (
        <div>
          {parent.primaryCaregiver ? (
            <Link to={`/parents/${parent.id}/caregivers`} className="text-link">
              Change primary caregiver
            </Link>
          ) : (
            chooseLink
          )}
        </div>
      )}
    </div>
  );
}

function ParentCard({ parent, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await api.delete(`/parents/${parent.id}`);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
      setConfirming(false);
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-2xl">
        {parent.name}
        {parent.age && <span className="font-sans text-lg text-ink-soft">, {parent.age}</span>}
      </h2>
      {parent.address && <p className="text-ink-soft">{parent.address}</p>}
      <p className="mt-1 font-medium">{parent.planName ? `${parent.planName} plan` : 'No plan yet'}</p>

      <div className="mt-3 space-y-1">
        {parent.primaryCaregiver && (
          <PersonLine label="Primary caregiver" person={parent.primaryCaregiver} />
        )}
        {parent.canReviewPrimary && (
          <ReviewForm
            caregiverId={parent.primaryCaregiver.id}
            caregiverName={parent.primaryCaregiver.name}
            onDone={onChanged}
          />
        )}
        {parent.backupCaregiver && (
          <PersonLine label="Backup caregiver" person={parent.backupCaregiver} />
        )}
        {parent.careManager && <PersonLine label="Care manager" person={parent.careManager} />}
      </div>

      <CaregiverSection parent={parent} onChanged={onChanged} onError={setError} />
      <CheckInSummary parentId={parent.id} />
      <ParentSosLink parent={parent} />

      <div className="mt-3">
        <FormAlert>{error}</FormAlert>
      </div>

      {confirming ? (
        <div className="mt-4 rounded-xl bg-sand p-4">
          <p className="font-semibold">Remove {parent.name}?</p>
          <p className="text-ink-soft">Their profile and health details will be deleted.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="btn bg-danger text-white"
            >
              Yes, remove
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary">
              Keep
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`/parents/${parent.id}/edit`} className="btn btn-secondary">
            {parent.profileComplete ? 'Edit details' : 'Add details'}
          </Link>
          <button type="button" onClick={() => setConfirming(true)} className="btn text-danger underline">
            Remove
          </button>
        </div>
      )}
    </li>
  );
}

export default function Parents() {
  usePageTitle('My Parents');
  const { state } = useLocation();
  const { data, loading, error, reload } = useApi('/parents');
  useLiveEvents(['notification:new'], reload);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.parents.length === 0) {
      return <p className="mt-6 text-ink-soft">Add your first parent to get started.</p>;
    }

    return (
      <ul className="mt-6 space-y-4">
        {data.parents.map((parent) => (
          <ParentCard key={parent.id} parent={parent} onChanged={reload} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">My Parents</h1>
        <Link to="/parents/new" className="btn btn-primary">
          Add a parent
        </Link>
      </div>
      <div className="mt-4">
        <FormAlert tone="success">{state?.notice}</FormAlert>
      </div>
      {content()}
    </div>
  );
}
