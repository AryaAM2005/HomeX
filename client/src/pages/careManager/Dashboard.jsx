import { Link } from 'react-router';
import { useLiveEvents } from '../../api/socket';
import DashboardShell from '../../components/DashboardShell';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { formatDateTime } from '../../utils/format';

function ActiveAlerts() {
  const { data, reload } = useApi('/alerts');
  useLiveEvents(['alert:new', 'alert:updated'], reload);

  if (!data) return null;

  const count = data.alerts.length;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-5">
      <p className="text-xl">
        <strong>{count}</strong> active {count === 1 ? 'alert' : 'alerts'}
      </p>
      <Link to="/care-manager/alerts" className="btn btn-primary mt-3">
        Open Live Alerts
      </Link>
    </div>
  );
}

function ParentRow({ parent }) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <Link to={`/care-manager/parents/${parent.id}`} className="text-link text-xl">
          {parent.name}
          {parent.age ? `, ${parent.age}` : ''}
        </Link>
        {parent.activeAlerts > 0 && (
          <span className="font-semibold text-sos">
            {parent.activeAlerts} active {parent.activeAlerts === 1 ? 'alert' : 'alerts'}
          </span>
        )}
      </div>
      <p className="text-ink-soft">
        {parent.planName ? `${parent.planName} plan` : 'No plan'}.{' '}
        {parent.primaryCaregiver
          ? `Primary: ${parent.primaryCaregiver.name}.`
          : 'No primary caregiver yet.'}{' '}
        {parent.backupCaregiver ? `Backup: ${parent.backupCaregiver.name}.` : 'No backup yet.'}
      </p>
      <p className="text-ink-soft">
        {parent.latestCheckIn
          ? `Last check-in: ${formatDateTime(parent.latestCheckIn)}`
          : 'No check-ins yet'}
      </p>
    </li>
  );
}

function Families() {
  const { data, loading, error, reload } = useApi('/caremanager/families');
  useLiveEvents(['alert:new', 'alert:updated', 'checkin:new'], reload);

  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  return (
    <section className="mt-8">
      <h2 className="text-3xl">My Families</h2>
      {data.families.length === 0 ? (
        <p className="mt-2 text-ink-soft">No families are assigned to you yet.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {data.families.map((family) => (
            <li key={family.id} className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-sans text-xl font-semibold">{family.name}</h3>
              <p>
                <a href={`tel:${family.phone}`} className="text-link">
                  {family.phone}
                </a>
                {family.country !== 'IN' && <span className="text-ink-soft"> (NRI family)</span>}
              </p>
              <ul className="mt-1 divide-y divide-line">
                {family.parents.map((parent) => (
                  <ParentRow key={parent.id} parent={parent} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function CareManagerDashboard() {
  return (
    <DashboardShell
      title="My Families"
      intro="Everyone in your care, with anything that needs attention first."
    >
      <ActiveAlerts />
      <Families />
    </DashboardShell>
  );
}
