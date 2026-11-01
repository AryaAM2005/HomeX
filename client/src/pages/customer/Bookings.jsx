import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api, getErrorMessage, getFieldErrors } from '../../api/client';
import { useLiveEvents } from '../../api/live';
import FormAlert from '../../components/FormAlert';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import ReviewForm from '../../components/ReviewForm';
import StatusTimeline, { statusLabel } from '../../components/StatusTimeline';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDateTime, formatMoney } from '../../utils/format';

const CANCELLABLE = ['REQUESTED', 'ACCEPTED', 'APPOINTMENT_FIXED'];

function paymentText({ paymentStatus, price, currency }) {
  if (paymentStatus === 'included') return 'Included in your plan';
  const amount = formatMoney(price, currency);
  return paymentStatus === 'refunded' ? `${amount}, refunded` : `${amount}, paid`;
}

function ComplaintSection({ booking, onChanged }) {
  const { complaint } = booking;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldError('');
    try {
      await api.post('/complaints', { bookingId: booking.id, message });
      setOpen(false);
      onChanged();
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.message) setFieldError(fields.message);
      else setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (complaint?.status === 'open') {
    return (
      <p className="mt-3 rounded-xl bg-sand px-4 py-3">
        We have your complaint and are looking into it.
      </p>
    );
  }

  return (
    <div className="mt-3">
      {complaint?.resolution && (
        <p className="mb-3 rounded-xl bg-sand px-4 py-3">
          <strong>Your complaint was resolved:</strong> {complaint.resolution}
        </p>
      )}
      {open ? (
        <form onSubmit={submit} noValidate className="space-y-3 rounded-xl bg-sand p-4">
          <FormAlert>{error}</FormAlert>
          <FormTextarea
            label="What went wrong?"
            rows={3}
            name="message"
            value={message}
            error={fieldError}
            onChange={(event) => setMessage(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn btn-primary">
              Send complaint
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
              Go back
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="text-link">
          Report a problem
        </button>
      )}
    </div>
  );
}

function BookingCard({ booking, onChanged }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cancel = async () => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/bookings/${booking.id}/status`, { action: 'cancel' });
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-2xl">{booking.label}</h2>
        <p className="font-semibold">{statusLabel(booking.status)}</p>
      </div>
      <p>
        For {booking.parent.name}, {formatDateTime(booking.scheduledAt)}
      </p>
      <p>
        <span className="text-ink-soft">Caregiver:</span> {booking.caregiver.name}{' '}
        {booking.caregiver.phone && (
          <a href={`tel:${booking.caregiver.phone}`} className="text-link whitespace-nowrap">
            {booking.caregiver.phone}
          </a>
        )}
      </p>
      <p className="text-ink-soft">{paymentText(booking)}</p>
      {booking.appointmentDetails && (
        <p className="mt-1">
          <strong>Appointment:</strong> {booking.appointmentDetails}
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer font-medium">Progress</summary>
        <StatusTimeline booking={booking} />
      </details>

      <div className="mt-3">
        <FormAlert>{error}</FormAlert>
      </div>

      {confirming ? (
        <div className="mt-3 rounded-xl bg-sand p-4">
          <p className="font-semibold">Cancel this booking?</p>
          {booking.paymentStatus === 'paid' && (
            <p className="text-ink-soft">Your payment will be refunded in full.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={cancel}
              className="btn bg-danger text-white"
            >
              Yes, cancel it
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary">
              Keep booking
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {booking.reportId && booking.parent.id && (
            <Link to={`/parents/${booking.parent.id}/reports`} className="btn btn-primary">
              Read care report
            </Link>
          )}
          {booking.canReview && (
            <ReviewForm
              caregiverId={booking.caregiver.id}
              caregiverName={booking.caregiver.name}
              bookingId={booking.id}
              onDone={onChanged}
            />
          )}
          {CANCELLABLE.includes(booking.status) && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="btn text-danger underline"
            >
              Cancel booking
            </button>
          )}
        </div>
      )}

      <ComplaintSection booking={booking} onChanged={onChanged} />
    </li>
  );
}

export default function Bookings() {
  usePageTitle('My Bookings');
  const { state } = useLocation();
  const { data, loading, error, reload } = useApi('/bookings');
  useLiveEvents(['booking:updated', 'connect'], reload);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.bookings.length === 0) {
      return (
        <p className="mt-6 text-ink-soft">
          No bookings yet. Start from{' '}
          <Link to="/parents" className="text-link">
            My Parents
          </Link>
          .
        </p>
      );
    }

    return (
      <ul className="mt-6 space-y-4">
        {data.bookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onChanged={reload} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">My Bookings</h1>
      <div className="mt-4">
        <FormAlert tone="success">{state?.notice}</FormAlert>
      </div>
      {content()}
    </div>
  );
}
