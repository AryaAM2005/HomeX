import { useState } from 'react';
import { CircleAlert, CircleCheck, CircleDot } from 'lucide-react';
import { Link } from 'react-router';
import { api, getErrorMessage, getFieldErrors } from '../api/client';
import { useLiveEvents } from '../api/socket';
import FormAlert from '../components/FormAlert';
import FormTextarea from '../components/FormTextarea';
import LoadError from '../components/LoadError';
import Loading from '../components/Loading';
import Toggle from '../components/Toggle';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDateTime } from '../utils/format';

const VIEW_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS = {
  open: { label: 'Open', Icon: CircleAlert, tone: 'text-sos' },
  acknowledged: { label: 'Acknowledged', Icon: CircleDot, tone: 'text-clay-dark' },
  resolved: { label: 'Resolved', Icon: CircleCheck, tone: 'text-leaf' },
};

const HEADINGS = {
  customer: {
    title: 'Alerts',
    intro: 'Emergencies and anything that needs attention. Your care manager handles each one.',
  },
  careManager: {
    title: 'Live Alerts',
    intro: 'New alerts appear here as they happen. Acknowledge an SOS within 5 minutes.',
  },
  admin: { title: 'Escalations', intro: 'SOS alerts that nobody acknowledged in time.' },
};

function StatusLabel({ status }) {
  const { label, Icon, tone } = STATUS[status];

  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${tone}`}>
      <Icon aria-hidden="true" size={20} />
      {label}
    </span>
  );
}

function ContactDetails({ contact }) {
  return (
    <dl className="mt-3 grid gap-2 rounded-xl bg-sand p-4 sm:grid-cols-2">
      <div>
        <dt className="text-base text-ink-soft">Family</dt>
        <dd>
          {contact.familyName}{' '}
          <a href={`tel:${contact.familyPhone}`} className="text-link whitespace-nowrap">
            {contact.familyPhone}
          </a>
        </dd>
      </div>
      {contact.emergencyContact && (
        <div>
          <dt className="text-base text-ink-soft">Emergency contact</dt>
          <dd>
            {contact.emergencyContact.name}{' '}
            <a href={`tel:${contact.emergencyContact.phone}`} className="text-link whitespace-nowrap">
              {contact.emergencyContact.phone}
            </a>
          </dd>
        </div>
      )}
      {contact.address && (
        <div className="sm:col-span-2">
          <dt className="text-base text-ink-soft">Address</dt>
          <dd>{contact.address}</dd>
        </div>
      )}
    </dl>
  );
}

function AlertActions({ alert, onChanged }) {
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = async (body) => {
    setBusy(true);
    setError('');
    setNoteError('');
    try {
      await api.patch(`/alerts/${alert.id}`, body);
      setResolving(false);
      onChanged();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.note) setNoteError(fields.note);
      else setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <FormAlert>{error}</FormAlert>

      {alert.status === 'open' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => update({ action: 'acknowledge' })}
          className="btn btn-primary"
        >
          Acknowledge
        </button>
      )}

      {alert.status === 'acknowledged' && !resolving && (
        <button type="button" onClick={() => setResolving(true)} className="btn btn-primary">
          Resolve
        </button>
      )}

      {resolving && (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            update({ action: 'resolve', note });
          }}
          className="space-y-3"
        >
          <FormTextarea
            label="What was done?"
            rows={3}
            name="note"
            value={note}
            error={noteError}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn btn-primary">
              Mark resolved
            </button>
            <button type="button" onClick={() => setResolving(false)} className="btn btn-secondary">
              Go back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AlertCard({ alert, canAct, canOpenParent, onChanged }) {
  const resolvedNote = alert.history.find(({ status }) => status === 'resolved')?.note;
  const isSos = alert.type === 'sos';

  return (
    <li
      className={`rounded-2xl bg-white p-5 ${
        isSos && alert.status !== 'resolved' ? 'border-3 border-sos' : 'border border-line'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-2xl">{alert.title}</h2>
        <StatusLabel status={alert.status} />
      </div>
      {canOpenParent ? (
        <Link to={`/care-manager/parents/${alert.parent.id}`} className="text-link">
          {alert.parent.name}
        </Link>
      ) : (
        <p className="font-semibold">{alert.parent.name}</p>
      )}
      <p>{alert.message}</p>
      <p className="text-ink-soft">{formatDateTime(alert.createdAt)}</p>
      {alert.escalated && <p className="font-semibold text-sos">Escalated to HOMEX admin</p>}
      {resolvedNote && (
        <p className="mt-2 rounded-xl bg-sand px-4 py-3">
          <strong>Resolved:</strong> {resolvedNote}
        </p>
      )}

      {alert.contact && alert.status !== 'resolved' && <ContactDetails contact={alert.contact} />}
      {canAct && alert.status !== 'resolved' && <AlertActions alert={alert} onChanged={onChanged} />}
    </li>
  );
}

export default function AlertsPage() {
  const { user } = useAuth();
  const { title, intro } = HEADINGS[user.role];
  usePageTitle(title);

  const [view, setView] = useState('active');
  const { data, loading, error, reload } = useApi(`/alerts?status=${view}`);
  useLiveEvents(['alert:new', 'alert:updated', 'connect'], reload);

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.alerts.length === 0) {
      return (
        <p className="mt-6 text-ink-soft">
          {view === 'active' ? 'Nothing needs attention right now.' : 'No resolved alerts yet.'}
        </p>
      );
    }

    return (
      <ul className="mt-6 space-y-4">
        {data.alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            canAct={user.role !== 'customer'}
            canOpenParent={user.role === 'careManager'}
            onChanged={reload}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">{title}</h1>
      <p className="mt-2 text-ink-soft">{intro}</p>
      <div className="mt-6">
        <Toggle legend="Show alerts" value={view} onChange={setView} options={VIEW_OPTIONS} />
      </div>
      {list()}
    </div>
  );
}
