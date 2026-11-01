import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api, getErrorMessage, getFieldErrors } from '../../api/client';
import { useLiveEvents } from '../../api/live';
import FormAlert from '../../components/FormAlert';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import StatusTimeline, { statusLabel } from '../../components/StatusTimeline';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDateTime, formatMoney } from '../../utils/format';

const HISTORY_STATUSES = ['COMPLETED', 'REPORT_SUBMITTED', 'REJECTED', 'CANCELLED'];

function ParentDetails({ booking }) {
  const { parent, family } = booking;

  return (
    <dl className="mt-3 space-y-2 rounded-xl bg-sand p-4">
      <div>
        <dt className="text-base text-ink-soft">Address</dt>
        <dd>{parent.address || 'Not added yet'}</dd>
      </div>
      <div>
        <dt className="text-base text-ink-soft">Health conditions</dt>
        <dd>{parent.conditions.join(', ') || 'None listed'}</dd>
      </div>
      <div>
        <dt className="text-base text-ink-soft">Allergies</dt>
        <dd>{parent.allergies.join(', ') || 'None listed'}</dd>
      </div>
      <div>
        <dt className="text-base text-ink-soft">Family contact</dt>
        <dd>
          {family.name}{' '}
          <a href={`tel:${family.phone}`} className="text-link whitespace-nowrap">
            {family.phone}
          </a>
        </dd>
      </div>
      {parent.emergencyContact && (
        <div>
          <dt className="text-base text-ink-soft">Emergency contact</dt>
          <dd>
            {parent.emergencyContact.name}{' '}
            <a href={`tel:${parent.emergencyContact.phone}`} className="text-link whitespace-nowrap">
              {parent.emergencyContact.phone}
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

function BookingActions({ booking, onChanged }) {
  const [panel, setPanel] = useState(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const act = async (action, body = {}) => {
    setBusy(true);
    setError('');
    setNoteError('');
    try {
      await api.patch(`/bookings/${booking.id}/status`, { action, ...body });
      setPanel(null);
      onChanged();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.note) setNoteError(fields.note);
      else setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const button = (label, action, primary = true) => (
    <button
      type="button"
      disabled={busy}
      onClick={() => act(action)}
      className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
    >
      {label}
    </button>
  );

  const { status, needsAppointment, needsReport } = booking;

  return (
    <div className="mt-3 space-y-3">
      <FormAlert>{error}</FormAlert>

      {panel === 'appointment' ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            act('fix_appointment', { note });
          }}
          className="space-y-3 rounded-xl bg-sand p-4"
        >
          <FormTextarea
            label="Appointment details"
            hint="The doctor or lab, the place and the time"
            rows={2}
            name="note"
            value={note}
            error={noteError}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn btn-primary">
              Save appointment
            </button>
            <button type="button" onClick={() => setPanel(null)} className="btn btn-secondary">
              Go back
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {status === 'REQUESTED' && (
            <>
              {button('Accept', 'accept')}
              {button('Decline', 'reject', false)}
            </>
          )}
          {status === 'ACCEPTED' && needsAppointment && (
            <button type="button" onClick={() => setPanel('appointment')} className="btn btn-primary">
              Fix appointment
            </button>
          )}
          {((status === 'ACCEPTED' && !needsAppointment) || status === 'APPOINTMENT_FIXED') &&
            button('Start visit', 'start')}
          {status === 'IN_PROGRESS' && button('Finish visit', 'complete')}
          {status === 'COMPLETED' && needsReport && (
            <Link to={`/caregiver/bookings/${booking.id}/report`} className="btn btn-primary">
              Submit care report
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, onChanged }) {
  const hasDetails = Boolean(booking.family);
  const isOpen = !HISTORY_STATUSES.includes(booking.status) || booking.status === 'COMPLETED';

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-2xl">{booking.label}</h3>
        <p className="font-semibold">{statusLabel(booking.status)}</p>
      </div>
      <p>
        For {booking.parent.name}
        {booking.parent.age && `, ${booking.parent.age}`}
      </p>
      <p>{formatDateTime(booking.scheduledAt)}</p>
      <p className="text-ink-soft">You earn {formatMoney(booking.earningInr, 'INR')}</p>
      {booking.notes && (
        <p className="mt-1">
          <strong>From the family:</strong> {booking.notes}
        </p>
      )}
      {booking.appointmentDetails && (
        <p className="mt-1">
          <strong>Appointment:</strong> {booking.appointmentDetails}
        </p>
      )}

      {booking.status === 'REQUESTED' && (
        <p className="mt-1 text-ink-soft">
          You will see the address and health details once you accept.
        </p>
      )}
      {hasDetails && isOpen && <ParentDetails booking={booking} />}

      <details className="mt-2">
        <summary className="cursor-pointer font-medium">Progress</summary>
        <StatusTimeline booking={booking} />
      </details>

      {isOpen && <BookingActions booking={booking} onChanged={onChanged} />}
    </li>
  );
}

export default function CaregiverBookings() {
  usePageTitle('Bookings');
  const { state } = useLocation();
  const { data, loading, error, reload } = useApi('/bookings');
  useLiveEvents(['booking:updated', 'connect'], reload);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const active = data.bookings.filter(
      ({ status }) => !HISTORY_STATUSES.includes(status) || status === 'COMPLETED',
    );
    const past = data.bookings.filter((booking) => !active.includes(booking));

    return (
      <>
        <h2 className="mt-6 text-3xl">Active</h2>
        {active.length === 0 ? (
          <p className="mt-2 text-ink-soft">No active bookings right now.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {active.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onChanged={reload} />
            ))}
          </ul>
        )}

        {past.length > 0 && (
          <>
            <h2 className="mt-10 text-3xl">Past</h2>
            <ul className="mt-3 space-y-4">
              {past.map((booking) => (
                <BookingCard key={booking.id} booking={booking} onChanged={reload} />
              ))}
            </ul>
          </>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Bookings</h1>
      <div className="mt-4">
        <FormAlert tone="success">{state?.notice}</FormAlert>
      </div>
      {content()}
    </div>
  );
}
