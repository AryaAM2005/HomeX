import { Link } from 'react-router';
import CheckInSummary from '../../components/CheckInSummary';
import DashboardShell from '../../components/DashboardShell';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { renewalText, StatusBadge } from '../../components/SubscriptionStatus';
import { useApi } from '../../hooks/useApi';

function SubscriptionSummary() {
  const { data, loading, error, reload } = useApi('/subscriptions');

  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const running = data.subscriptions.filter(({ status }) => status !== 'cancelled');

  if (running.length === 0) {
    return (
      <div className="mt-8 rounded-2xl bg-sand p-6">
        <h2 className="text-2xl">Start with a plan</h2>
        <p className="mt-1 text-ink-soft">Your first plan comes with a 7-day free trial.</p>
        <Link to="/plans" className="btn btn-primary mt-4">
          See plans
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-8 space-y-4">
      {running.map((subscription) => (
        <li key={subscription.id} className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl">{subscription.parent.name}</h2>
            <StatusBadge status={subscription.status} />
          </div>
          <p className="mt-1 font-semibold">{subscription.plan.name} plan</p>
          <p className="text-ink-soft">{renewalText(subscription)}</p>
          <CheckInSummary parentId={subscription.parent.id} />
          <div className="mt-2 flex flex-wrap gap-x-5">
            <Link to="/parents" className="text-link">
              Parent and caregiver
            </Link>
            <Link to="/billing" className="text-link">
              Manage plan
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CustomerDashboard() {
  return (
    <DashboardShell
      title="Family dashboard"
      intro="See how your parents are doing, every day."
    >
      <SubscriptionSummary />
    </DashboardShell>
  );
}
