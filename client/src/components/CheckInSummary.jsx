import { Link } from 'react-router';
import { useLiveEvents } from '../api/live';
import { moodLabel } from '../data/care';
import { useApi } from '../hooks/useApi';
import { formatDateTime } from '../utils/format';

// The family's quick view of how a parent's day went.
export default function CheckInSummary({ parentId }) {
  const { data, reload } = useApi(`/parents/${parentId}/checkins`);
  useLiveEvents(['checkin:new'], reload);

  return (
    <div className="mt-3 rounded-xl bg-sand px-4 py-3">
      {data?.latest ? (
        <p>
          <strong>Latest check-in:</strong> {formatDateTime(data.latest.time)} by{' '}
          {data.latest.caregiverName}. Mood: {moodLabel(data.latest.mood)}.
        </p>
      ) : (
        <p>No check-ins yet.</p>
      )}
      <div className="flex flex-wrap gap-x-5">
        <Link to={`/parents/${parentId}/checkins`} className="text-link">
          Check-in history
        </Link>
        <Link to={`/parents/${parentId}/medicines`} className="text-link">
          Medicines
        </Link>
        <Link to={`/parents/${parentId}/reports`} className="text-link">
          Reports
        </Link>
        <Link to={`/parents/${parentId}/book`} className="text-link">
          Book a service
        </Link>
      </div>
    </div>
  );
}
