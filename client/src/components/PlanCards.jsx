import { useState } from 'react';
import { Check } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { detectCurrency, formatMoney } from '../utils/format';
import LoadError from './LoadError';
import Loading from './Loading';
import Toggle, { CURRENCY_OPTIONS, CYCLE_OPTIONS } from './Toggle';

export default function PlanCards() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { data, loading, error, reload } = useApi('/plans');
  const [chosenCurrency, setChosenCurrency] = useState(null);
  const [cycle, setCycle] = useState('monthly');
  const currency = chosenCurrency ?? detectCurrency(user);
  const code = searchParams.get('code');

  if (loading) return <Loading />;
  if (error) return <LoadError message={error} onRetry={reload} />;

  const checkoutPath = (plan) => {
    const query = new URLSearchParams({ cycle, currency });
    if (code) query.set('code', code);
    return `/subscribe/${plan.id}?${query}`;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Toggle legend="Billing cycle" value={cycle} onChange={setCycle} options={CYCLE_OPTIONS} />
        <Toggle
          legend="Currency"
          value={currency}
          onChange={setChosenCurrency}
          options={CURRENCY_OPTIONS}
        />
      </div>
      {cycle === 'annual' && <p className="mt-3 font-medium text-leaf">Pay for 10 months, get 12.</p>}
      {code && (
        <p className="mt-3 font-medium text-leaf">
          Code {code} will be applied when you choose a plan.
        </p>
      )}

      <ul className="mt-8 grid gap-6 lg:grid-cols-3">
        {data.plans.map((plan) => (
          <li
            key={plan.id}
            className={`flex flex-col rounded-2xl bg-white p-6 ${
              plan.recommended ? 'border-3 border-clay' : 'border border-line'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl">{plan.name}</h3>
              {plan.recommended && (
                <span className="rounded-full bg-clay px-3 py-0.5 text-base font-semibold text-white">
                  Recommended
                </span>
              )}
            </div>
            <p className="mt-1 text-ink-soft">{plan.summary}</p>
            <p className="mt-4">
              <span className="font-display text-4xl font-semibold">
                {formatMoney(plan.prices[currency][cycle], currency)}
              </span>
              <span className="text-ink-soft"> / {cycle === 'annual' ? 'year' : 'month'}</span>
            </p>
            <ul className="mt-5 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <Check aria-hidden="true" size={22} className="mt-0.5 shrink-0 text-leaf" />
                  {feature}
                </li>
              ))}
            </ul>
            {(!user || user.role === 'customer') && (
              <Link
                to={user ? checkoutPath(plan) : '/signup'}
                state={user ? undefined : { from: checkoutPath(plan) }}
                className={`btn mt-6 ${plan.recommended ? 'btn-primary' : 'btn-secondary'}`}
                aria-label={`${user ? 'Choose' : 'Start a 7-day free trial of'} ${plan.name}`}
              >
                {user ? `Choose ${plan.name}` : 'Start 7-day free trial'}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
