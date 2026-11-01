import { useState } from 'react';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { statusLabel } from '../../components/StatusTimeline';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDateTime, formatMoney } from '../../utils/format';

const STATUSES = [
  'REQUESTED',
  'ACCEPTED',
  'APPOINTMENT_FIXED',
  'IN_PROGRESS',
  'COMPLETED',
  'REPORT_SUBMITTED',
  'REJECTED',
  'CANCELLED',
];

const PAYMENT_LABELS = { included: 'Included in plan', paid: 'Paid', refunded: 'Refunded' };

export default function AdminBookings() {
  usePageTitle('Bookings');
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useApi(
    `/admin/bookings${status ? `?status=${status}` : ''}`,
  );

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.bookings.length === 0) return <p className="mt-4 text-ink-soft">No bookings here.</p>;

    return (
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {data.bookings.map((booking) => (
          <li key={booking.id} className="py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className="font-semibold">{booking.label}</p>
              <p>{statusLabel(booking.status)}</p>
            </div>
            <p>{formatDateTime(booking.scheduledAt)}</p>
            <p className="text-ink-soft">
              {booking.parentName}, booked by {booking.customerName}. Caregiver:{' '}
              {booking.caregiverName}.
            </p>
            <p className="text-ink-soft">
              {PAYMENT_LABELS[booking.paymentStatus]}
              {booking.paymentStatus !== 'included' &&
                `, ${formatMoney(booking.price, booking.currency)}`}
            </p>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Bookings</h1>
      <div className="mt-6 max-w-xs">
        <label htmlFor="status" className="block font-semibold">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2"
        >
          <option value="">All bookings</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
      </div>
      {list()}
    </div>
  );
}
