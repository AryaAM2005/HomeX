import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { api, getErrorMessage } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { renewalText, StatusBadge } from '../../components/SubscriptionStatus';
import Toggle, { CYCLE_OPTIONS } from '../../components/Toggle';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate, formatMoney } from '../../utils/format';

function ChangePlanForm({ subscription, plans, onSubmit, onClose, busy }) {
  const [planId, setPlanId] = useState(subscription.plan.id);
  const [cycle, setCycle] = useState(subscription.billingCycle);
  const selected = plans.find((plan) => plan.id === planId);
  const unchanged = planId === subscription.plan.id && cycle === subscription.billingCycle;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ action: 'change_plan', planId, billingCycle: cycle });
      }}
      className="mt-4 space-y-4 rounded-xl bg-sand p-4"
    >
      <div>
        <label htmlFor={`plan-${subscription.id}`} className="block font-semibold">
          New plan
        </label>
        <select
          id={`plan-${subscription.id}`}
          value={planId}
          onChange={(event) => setPlanId(event.target.value)}
          className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2"
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}, {formatMoney(plan.prices[subscription.currency].monthly, subscription.currency)} a
              month
            </option>
          ))}
        </select>
      </div>
      <Toggle legend="New billing cycle" value={cycle} onChange={setCycle} options={CYCLE_OPTIONS} />
      <p className="text-ink-soft">
        The new plan starts now. {formatMoney(selected.prices[subscription.currency][cycle], subscription.currency)}{' '}
        is charged from your next billing date
        {subscription.discountPct > 0 ? `, less your ${subscription.discountPct}% discount` : ''}.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy || unchanged} className="btn btn-primary">
          Save change
        </button>
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Keep current plan
        </button>
      </div>
    </form>
  );
}

function SubscriptionCard({ subscription, plans, onChanged }) {
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isRunning = subscription.status !== 'cancelled';

  const update = async (body) => {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/subscriptions/${subscription.id}`, body);
      setPanel(null);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-2xl">{subscription.parent.name}</h3>
        <StatusBadge status={subscription.status} />
      </div>
      <p className="mt-1 font-semibold">
        {subscription.plan.name} plan, {subscription.billingCycle}
      </p>
      <p className="text-ink-soft">{renewalText(subscription)}</p>
      {subscription.discountPct > 0 && (
        <p className="text-ink-soft">
          {subscription.discountPct}% employer discount ({subscription.discountCode})
        </p>
      )}

      <div className="mt-3">
        <FormAlert>{error}</FormAlert>
      </div>

      {isRunning && !panel && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={() => setPanel('change')} className="btn btn-secondary">
            Change plan
          </button>
          {subscription.status === 'trial' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => update({ action: 'pay_now' })}
              className="btn btn-primary"
            >
              End trial and pay now
            </button>
          )}
          <button type="button" onClick={() => setPanel('cancel')} className="btn text-danger underline">
            Cancel plan
          </button>
        </div>
      )}

      {panel === 'change' && (
        <ChangePlanForm
          subscription={subscription}
          plans={plans}
          busy={busy}
          onSubmit={update}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'cancel' && (
        <div className="mt-4 rounded-xl bg-sand p-4">
          <p className="font-semibold">Cancel {subscription.parent.name}'s plan?</p>
          <p className="text-ink-soft">
            You will not be charged again. Care continues until {formatDate(subscription.renewsAt)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => update({ action: 'cancel' })}
              className="btn bg-danger text-white"
            >
              Yes, cancel plan
            </button>
            <button type="button" onClick={() => setPanel(null)} className="btn btn-secondary">
              Keep plan
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Billing() {
  usePageTitle('Subscription & Billing');
  const { state } = useLocation();
  const subscriptions = useApi('/subscriptions');
  const plans = useApi('/plans');
  const payments = useApi('/subscriptions/payments');

  const refresh = () => {
    subscriptions.reload();
    payments.reload();
  };

  const failure = subscriptions.error || plans.error || payments.error;
  const content = () => {
    if (failure) {
      return (
        <LoadError
          message={failure}
          onRetry={() => {
            refresh();
            plans.reload();
          }}
        />
      );
    }
    if (!subscriptions.data || !plans.data || !payments.data) return <Loading />;

    return (
      <>
        <p className="mt-6 rounded-xl bg-sand px-4 py-3">
          <strong>Credit balance: {formatMoney(subscriptions.data.credit, 'INR')}.</strong> Credit is
          used automatically on your next payment.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-3xl">Your plans</h2>
          <Link to="/plans" className="btn btn-secondary">
            Add a plan
          </Link>
        </div>

        {subscriptions.data.subscriptions.length === 0 ? (
          <p className="mt-4 text-ink-soft">
            You have no plans yet. Your first plan comes with a 7-day free trial.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {subscriptions.data.subscriptions.map((subscription) => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                plans={plans.data.plans}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}

        <h2 className="mt-12 text-3xl">Payment history</h2>
        {payments.data.payments.length === 0 ? (
          <p className="mt-4 text-ink-soft">No payments yet.</p>
        ) : (
          <table className="mt-4 w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-line">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Date
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Details
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.data.payments.map((payment) => (
                <tr key={payment.id} className="border-b border-line align-top">
                  <td className="py-2 pr-4">{formatDate(payment.date)}</td>
                  <td className="py-2 pr-4">
                    {payment.description}
                    {payment.status === 'refunded' ? ' (refunded)' : ''}
                  </td>
                  <td className="py-2 text-right">{formatMoney(payment.amount, payment.currency)}</td>
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
      <h1 className="text-4xl">Subscription &amp; Billing</h1>
      <div className="mt-4">
        <FormAlert tone="success">{state?.notice}</FormAlert>
      </div>
      {content()}
    </div>
  );
}
