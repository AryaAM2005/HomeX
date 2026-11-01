import { CheckCircle2 } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useLiveEvents } from '../../api/live';
import DashboardShell from '../../components/DashboardShell';
import FormAlert from '../../components/FormAlert';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import VerificationStatus from '../../components/VerificationStatus';
import { useApi } from '../../hooks/useApi';

function dosesText(doses) {
  const waiting = doses.filter(({ status }) => status === null);
  if (doses.length === 0) return 'No medicines today.';
  if (waiting.length === 0) return 'All of today’s medicines are logged.';
  return `Still to log: ${waiting.map(({ name, time }) => `${name} at ${time}`).join(', ')}.`;
}

function VisitCard({ visit }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <h3 className="text-2xl">
          {visit.name}
          {visit.age && <span className="font-sans text-lg text-ink-soft">, {visit.age}</span>}
        </h3>
        {visit.checkedInToday && (
          <span className="inline-flex items-center gap-1 font-semibold text-leaf">
            <CheckCircle2 aria-hidden="true" size={20} />
            Checked in
          </span>
        )}
      </div>
      {visit.address && <p className="text-ink-soft">{visit.address}</p>}
      <p className="mt-1">{dosesText(visit.doses)}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link to={`/caregiver/checkin/${visit.id}`} className="btn btn-primary">
          Log check-in
        </Link>
        <Link to={`/caregiver/medicines/${visit.id}`} className="btn btn-secondary">
          Medicines
        </Link>
      </div>
    </li>
  );
}

function TodaysVisits() {
  const { data, loading, error, reload } = useApi('/checkins/today');

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="mt-6">
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <section className="mt-8">
      <h2 className="text-3xl">Today's visits</h2>
      {data.visits.length === 0 ? (
        <p className="mt-2 text-ink-soft">Families appear here once you accept a request.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {data.visits.map((visit) => (
            <VisitCard key={visit.id} visit={visit} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestsSummary() {
  const requests = useApi('/caregivers/me/requests');
  const bookings = useApi('/bookings');
  useLiveEvents(['booking:updated'], bookings.reload);

  const familyCount = requests.data?.requests.length ?? 0;
  const bookingCount =
    bookings.data?.bookings.filter(({ status }) => status === 'REQUESTED').length ?? 0;

  return (
    <>
      {familyCount > 0 && (
        <p className="mt-6 rounded-xl border-2 border-marigold bg-white px-4 py-3">
          <strong>
            {familyCount} {familyCount === 1 ? 'family wants' : 'families want'} you as their
            caregiver.
          </strong>{' '}
          <Link to="/caregiver/requests" className="text-link">
            Review now
          </Link>
        </p>
      )}
      {bookingCount > 0 && (
        <p className="mt-6 rounded-xl border-2 border-marigold bg-white px-4 py-3">
          <strong>
            {bookingCount} new {bookingCount === 1 ? 'booking' : 'bookings'}.
          </strong>{' '}
          <Link to="/caregiver/bookings" className="text-link">
            Review now
          </Link>
        </p>
      )}
    </>
  );
}

function Status() {
  const { data, loading, error, reload } = useApi('/caregivers/me');

  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={reload} />;
  return <VerificationStatus profile={data.profile} showLink />;
}

export default function CaregiverDashboard() {
  const { state } = useLocation();

  return (
    <DashboardShell
      title="Today"
      intro="Your families for today. Log a check-in after every visit or call."
      notice={
        <>
          <div className="mt-4">
            <FormAlert tone="success">{state?.notice}</FormAlert>
          </div>
          <Status />
        </>
      }
    >
      <RequestsSummary />
      <TodaysVisits />
    </DashboardShell>
  );
}
