import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate, formatMoney } from '../../utils/format';

export default function Earnings() {
  usePageTitle('Earnings');
  const { data, loading, error, reload } = useApi('/caregivers/me/earnings');

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    return (
      <>
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-sand p-5">
            <dt className="text-ink-soft">This month</dt>
            <dd className="font-display text-4xl font-semibold">
              {formatMoney(data.thisMonthInr, 'INR')}
            </dd>
          </div>
          <div className="rounded-2xl bg-sand p-5">
            <dt className="text-ink-soft">All time</dt>
            <dd className="font-display text-4xl font-semibold">
              {formatMoney(data.totalInr, 'INR')}
            </dd>
          </div>
          <div className="rounded-2xl bg-sand p-5">
            <dt className="text-ink-soft">Finished bookings</dt>
            <dd className="font-display text-4xl font-semibold">{data.completedCount}</dd>
          </div>
        </dl>

        <h2 className="mt-10 text-3xl">Finished bookings</h2>
        {data.items.length === 0 ? (
          <p className="mt-2 text-ink-soft">Your earnings appear here after each finished booking.</p>
        ) : (
          <table className="mt-3 w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-line">
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 font-semibold">
                  Booking
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Earned
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3">{formatDate(item.date)}</td>
                  <td className="py-2 pr-3">
                    {item.label}, {item.parentName}
                  </td>
                  <td className="py-2 text-right">{formatMoney(item.earningInr, 'INR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Earnings</h1>
      <p className="mt-2 text-ink-soft">You earn 80% of the price of each finished booking.</p>
      {content()}
    </div>
  );
}
