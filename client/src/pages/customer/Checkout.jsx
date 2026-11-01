import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, getErrorMessage, getFieldErrors } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import Toggle, { CURRENCY_OPTIONS, CYCLE_OPTIONS } from '../../components/Toggle';
import { useAuth } from '../../context/useAuth';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { detectCurrency, formatDate, formatMoney } from '../../utils/format';

const NEW_PARENT = 'new';

function PriceRow({ label, value, strong }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function Checkout() {
  usePageTitle('Checkout');
  const { planId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const parents = useApi('/parents');

  const [cycle, setCycle] = useState(searchParams.get('cycle') === 'annual' ? 'annual' : 'monthly');
  const [currency, setCurrency] = useState(() =>
    ['INR', 'USD'].includes(searchParams.get('currency'))
      ? searchParams.get('currency')
      : detectCurrency(user),
  );
  const [chosenParent, setChosenParent] = useState(null);
  const [parentName, setParentName] = useState('');
  const [parentError, setParentError] = useState('');
  const [codeInput, setCodeInput] = useState(searchParams.get('code') ?? '');
  const [appliedCode, setAppliedCode] = useState(searchParams.get('code') ?? '');
  const [codeError, setCodeError] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    api
      .post('/subscriptions/quote', {
        planId,
        billingCycle: cycle,
        currency,
        code: appliedCode || undefined,
      })
      .then((res) => {
        if (ignore) return;
        setQuote(res.data);
        setQuoteError('');
      })
      .catch((err) => {
        if (ignore) return;
        const fieldError = getFieldErrors(err).code;
        if (fieldError) {
          setCodeError(fieldError);
          setAppliedCode('');
        } else {
          setQuoteError(getErrorMessage(err));
        }
      });

    return () => {
      ignore = true;
    };
  }, [planId, cycle, currency, appliedCode]);

  if (quoteError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <LoadError message={quoteError} onRetry={() => navigate('/plans')} />
      </div>
    );
  }
  if (!quote || parents.loading) return <Loading />;
  if (parents.error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <LoadError message={parents.error} onRetry={parents.reload} />
      </div>
    );
  }

  const openParents = parents.data.parents.filter((parent) => !parent.hasActivePlan);
  const parentChoice = chosenParent ?? openParents[0]?.id ?? NEW_PARENT;
  const money = (amount) => formatMoney(amount, currency);
  const { plan, price, trial } = quote;

  const applyCode = (event) => {
    event.preventDefault();
    setCodeError('');
    setAppliedCode(codeInput.trim());
  };

  const resolveParentId = async () => {
    if (parentChoice !== NEW_PARENT) return parentChoice;
    const res = await api.post('/parents', { name: parentName });
    setChosenParent(res.data.parent.id);
    parents.reload();
    return res.data.parent.id;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setParentError('');

    if (parentChoice === NEW_PARENT && parentName.trim().length < 2) {
      setParentError("Enter your parent's name");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/subscriptions', {
        planId,
        parentId: await resolveParentId(),
        billingCycle: cycle,
        currency,
        code: codeInput.trim() || undefined,
      });
      const { parent, status } = res.data.subscription;
      const notice =
        status === 'trial'
          ? `Your free trial for ${parent.name} has started.`
          : `${parent.name}'s plan is active. Payment received.`;
      navigate('/billing', { state: { notice } });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (fieldErrors.name) setParentError(fieldErrors.name);
      else if (fieldErrors.code) setCodeError(fieldErrors.code);
      else setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="font-semibold text-clay">Checkout</p>
      <h1 className="mt-1 text-4xl">{plan.name} plan</h1>
      <p className="mt-2 text-ink-soft">{plan.summary}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Toggle legend="Billing cycle" value={cycle} onChange={setCycle} options={CYCLE_OPTIONS} />
        <Toggle legend="Currency" value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
      </div>

      <form onSubmit={applyCode} noValidate className="mt-8">
        <label htmlFor="code" className="block font-semibold">
          Referral or employer code (optional)
        </label>
        <div className="mt-1.5 flex gap-3">
          <input
            id="code"
            name="code"
            value={codeInput}
            autoComplete="off"
            aria-invalid={codeError ? 'true' : undefined}
            aria-describedby={codeError ? 'code-error' : undefined}
            onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
            className={`min-h-12 w-full min-w-0 rounded-xl border-2 bg-white px-4 py-2 ${
              codeError ? 'border-danger' : 'border-line hover:border-ink-soft'
            }`}
          />
          <button type="submit" className="btn btn-secondary">
            Apply
          </button>
        </div>
        {codeError && (
          <p id="code-error" className="mt-1.5 text-base font-medium text-danger">
            {codeError}
          </p>
        )}
        {quote.code && <p className="mt-2 font-medium text-leaf">{quote.code.label}</p>}
      </form>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
        <FormAlert>{formError}</FormAlert>

        {openParents.length > 0 && (
          <div>
            <label htmlFor="parent" className="block font-semibold">
              Who is this plan for?
            </label>
            <select
              id="parent"
              value={parentChoice}
              onChange={(event) => setChosenParent(event.target.value)}
              className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2 hover:border-ink-soft"
            >
              {openParents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ))}
              <option value={NEW_PARENT}>Add another parent</option>
            </select>
          </div>
        )}

        {parentChoice === NEW_PARENT && (
          <FormField
            label="Your parent's name"
            hint="You can add their address and health details later."
            name="parentName"
            value={parentName}
            error={parentError}
            autoComplete="off"
            onChange={(event) => setParentName(event.target.value)}
          />
        )}

        <dl className="space-y-2 rounded-2xl border border-line bg-white p-5">
          <PriceRow
            label={`${plan.name}, ${cycle === 'annual' ? '12 months' : '1 month'}`}
            value={money(price.base)}
          />
          {price.discount > 0 && <PriceRow label="Employer discount" value={`-${money(price.discount)}`} />}
          {price.creditApplied > 0 && (
            <PriceRow label="Your credit" value={`-${money(price.creditApplied)}`} />
          )}
          <div className="border-t border-line pt-2">
            {trial ? (
              <>
                <PriceRow label="Due today" value={money(0)} strong />
                <p className="mt-1 text-ink-soft">
                  {money(price.total)} on {formatDate(quote.trialEndsAt)}, after your{' '}
                  {quote.trialDays}-day free trial. Cancel any time before then to pay nothing.
                </p>
              </>
            ) : (
              <PriceRow label="Due today" value={money(price.total)} strong />
            )}
          </div>
        </dl>

        <p className="rounded-xl bg-sand px-4 py-3">
          <strong>Test checkout.</strong> This is a demo, so no real money is taken and no card
          details are needed.
        </p>

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting && 'Please wait…'}
            {!submitting &&
              (trial ? `Start ${quote.trialDays}-day free trial` : `Pay ${money(price.total)}`)}
          </button>
          <Link to="/plans" className="btn btn-secondary">
            Back to plans
          </Link>
        </div>
      </form>
    </div>
  );
}
