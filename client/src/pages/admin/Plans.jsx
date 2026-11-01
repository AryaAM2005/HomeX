import { useState } from 'react';
import { api } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { compact } from '../../utils/validators';

function positiveError(value) {
  return Number(value) > 0 ? undefined : 'Enter a price above 0';
}

function countError(value) {
  const count = Number(value);
  return value !== '' && Number.isInteger(count) && count >= 0 && count <= 14
    ? undefined
    : 'Enter a number from 0 to 14';
}

function PlanEditor({ plan }) {
  const [saved, setSaved] = useState(false);

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      summary: plan.summary,
      features: plan.features.join('\n'),
      priceInr: String(plan.priceInr),
      usdPrice: String(plan.usdPrice),
      checkinsPerWeek: String(plan.checkinsPerWeek),
      visitsPerWeek: String(plan.visitsPerWeek),
      recommended: plan.recommended,
      active: plan.active,
    },
    validate: (form) =>
      compact({
        summary: form.summary.trim() ? undefined : 'Add a short summary',
        features: form.features.trim() ? undefined : 'Add at least one feature',
        priceInr: Number.isInteger(Number(form.priceInr))
          ? positiveError(form.priceInr)
          : 'Use whole rupees',
        usdPrice: positiveError(form.usdPrice),
        checkinsPerWeek: countError(form.checkinsPerWeek),
        visitsPerWeek: countError(form.visitsPerWeek),
      }),
    onSubmit: async (form) => {
      setSaved(false);
      await api.patch(`/admin/plans/${plan.id}`, {
        ...form,
        features: form.features
          .split('\n')
          .map((feature) => feature.trim())
          .filter(Boolean),
        priceInr: Number(form.priceInr),
        usdPrice: Number(form.usdPrice),
        checkinsPerWeek: Number(form.checkinsPerWeek),
        visitsPerWeek: Number(form.visitsPerWeek),
      });
      setSaved(true);
    },
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-2xl">{plan.name}</h2>
      <FormAlert>{formError}</FormAlert>
      <FormField label="Summary" {...field('summary')} />

      <div>
        <label htmlFor={`features-${plan.id}`} className="block font-semibold">
          Features, one per line
        </label>
        <textarea
          id={`features-${plan.id}`}
          name="features"
          rows={5}
          value={values.features}
          onChange={(event) => setValue('features', event.target.value)}
          aria-invalid={errors.features ? 'true' : undefined}
          aria-describedby={errors.features ? `features-${plan.id}-error` : undefined}
          className="mt-1.5 w-full rounded-xl border-2 border-line bg-white px-4 py-2 hover:border-ink-soft"
        />
        {errors.features && (
          <p id={`features-${plan.id}-error`} className="mt-1.5 text-base font-medium text-danger">
            {errors.features}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Price per month (INR)" inputMode="numeric" {...field('priceInr')} />
        <FormField label="Price per month (USD)" inputMode="decimal" {...field('usdPrice')} />
        <FormField label="Check-ins a week" inputMode="numeric" {...field('checkinsPerWeek')} />
        <FormField label="Home visits a week" inputMode="numeric" {...field('visitsPerWeek')} />
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(event) => setValue('active', event.target.checked)}
            className="size-5 accent-clay"
          />
          Show this plan to families
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={values.recommended}
            onChange={(event) => setValue('recommended', event.target.checked)}
            className="size-5 accent-clay"
          />
          Mark as recommended
        </label>
      </div>

      <FormAlert tone="success">{saved ? `${plan.name} saved.` : ''}</FormAlert>
      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'Saving…' : `Save ${plan.name}`}
      </button>
    </form>
  );
}

export default function AdminPlans() {
  usePageTitle('Plans');
  const { data, loading, error, reload } = useApi('/admin/plans');

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    return (
      <div className="mt-8 space-y-6">
        {data.plans.map((plan) => (
          <PlanEditor key={plan.id} plan={plan} />
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Plans</h1>
      <p className="mt-2 text-ink-soft">
        Price changes apply to new plans at once, and to existing plans from their next billing date.
      </p>
      {content()}
    </div>
  );
}
