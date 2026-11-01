import { Link } from 'react-router';
import { useLiveEvents } from '../../api/live';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { statusLabel } from '../../components/StatusTimeline';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';

function Stat({ label, value, to, detail }) {
  return (
    <div className="rounded-2xl bg-sand p-5">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-display text-4xl font-semibold">{value}</dd>
      {detail && <dd className="text-ink-soft">{detail}</dd>}
      {to && (
        <dd>
          <Link to={to} className="text-link">
            View
          </Link>
        </dd>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  usePageTitle('Admin dashboard');
  const { data, loading, error, reload } = useApi('/admin/stats');
  useLiveEvents(['alert:new', 'alert:updated', 'notification:new'], reload);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const { stats } = data;
    const totalBookings = stats.bookings.reduce((total, { count }) => total + count, 0);

    return (
      <>
        {stats.escalatedAlerts > 0 && (
          <p role="alert" className="mt-6 rounded-xl border-2 border-sos bg-white px-4 py-3">
            <strong>
              {stats.escalatedAlerts} escalated {stats.escalatedAlerts === 1 ? 'SOS' : 'SOS alerts'}.
            </strong>{' '}
            <Link to="/admin/alerts" className="text-link">
              Open escalations
            </Link>
          </p>
        )}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Families"
            value={stats.families}
            detail={`${stats.parents} parents`}
            to="/admin/users"
          />
          <Stat
            label="Active plans"
            value={stats.activePlans}
            detail={`${stats.trials} on free trial`}
          />
          <Stat
            label="Verified caregivers"
            value={stats.caregivers}
            detail={`${stats.pendingCaregivers} waiting for review`}
            to="/admin/caregivers"
          />
          <Stat label="Care managers" value={stats.careManagers} to="/admin/care-managers" />
          <Stat label="Open alerts" value={stats.openAlerts} />
          <Stat label="Open complaints" value={stats.openComplaints} to="/admin/complaints" />
          <Stat label="Bookings" value={totalBookings} to="/admin/bookings" />
        </dl>

        <h2 className="mt-10 text-3xl">Bookings by status</h2>
        <table className="mt-3 w-full max-w-md border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-line">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Status
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Bookings
              </th>
            </tr>
          </thead>
          <tbody>
            {stats.bookings.map(({ status, count }) => (
              <tr key={status} className="border-b border-line">
                <th scope="row" className="py-2 pr-4 font-normal">
                  {statusLabel(status)}
                </th>
                <td className="py-2 text-right">{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Admin dashboard</h1>
      {content()}
    </div>
  );
}
