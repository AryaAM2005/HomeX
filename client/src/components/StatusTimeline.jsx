import { Check, Circle, X } from 'lucide-react';
import { formatDateTime } from '../utils/format';

const LABELS = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  APPOINTMENT_FIXED: 'Appointment fixed',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  REPORT_SUBMITTED: 'Report submitted',
  REJECTED: 'Not accepted',
  CANCELLED: 'Cancelled',
};

const ENDED = ['REJECTED', 'CANCELLED'];

export const statusLabel = (status) => LABELS[status] ?? status;

function stepsFor(booking) {
  return [
    'REQUESTED',
    'ACCEPTED',
    ...(booking.needsAppointment ? ['APPOINTMENT_FIXED'] : []),
    'IN_PROGRESS',
    'COMPLETED',
    ...(booking.needsReport ? ['REPORT_SUBMITTED'] : []),
  ];
}

export default function StatusTimeline({ booking }) {
  const history = new Map(booking.statusHistory.map((entry) => [entry.status, entry]));
  const stopped = ENDED.includes(booking.status);
  const steps = stopped ? booking.statusHistory.map(({ status }) => status) : stepsFor(booking);

  return (
    <ol className="mt-3 space-y-2">
      {steps.map((status) => {
        const entry = history.get(status);
        const isEnd = ENDED.includes(status);

        return (
          <li key={status} className="flex gap-2">
            <span
              aria-hidden="true"
              className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full ${
                isEnd ? 'bg-danger text-white' : entry ? 'bg-leaf text-white' : 'text-line'
              }`}
            >
              {isEnd && <X size={14} strokeWidth={3} />}
              {!isEnd && entry && <Check size={14} strokeWidth={3} />}
              {!isEnd && !entry && <Circle size={18} />}
            </span>
            <div className="min-w-0">
              <p className={entry ? 'font-medium' : 'text-ink-soft'}>
                {statusLabel(status)}
                {!entry && <span className="sr-only"> (still to come)</span>}
              </p>
              {entry && <p className="text-base text-ink-soft">{formatDateTime(entry.at)}</p>}
              {entry?.note && <p className="text-base">{entry.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
