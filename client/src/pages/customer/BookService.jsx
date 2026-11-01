import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, getErrorMessage, getFieldErrors } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import Toggle, { CURRENCY_OPTIONS } from '../../components/Toggle';
import { useAuth } from '../../context/useAuth';
import { BOOKING_SERVICES } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { detectCurrency, formatMoney } from '../../utils/format';

const SELECT_CLASS =
  'mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2 hover:border-ink-soft';

function PriceSummary({ quote }) {
  if (!quote) return null;

  const money = (amount) => formatMoney(amount, quote.currency);

  if (quote.includedIn) {
    return (
      <p className="rounded-xl border-2 border-leaf bg-white px-4 py-3">
        <strong>Included in your {quote.includedIn} plan.</strong> Nothing to pay.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-white p-5">
      <div className="flex justify-between gap-4">
        <span>{quote.label}</span>
        <span>{money(quote.base)}</span>
      </div>
      {quote.creditApplied > 0 && (
        <div className="flex justify-between gap-4">
          <span>Your credit</span>
          <span>-{money(quote.creditApplied)}</span>
        </div>
      )}
      <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
        <span>Due today</span>
        <span>{money(quote.total)}</span>
      </div>
      <p className="text-ink-soft">Refunded in full if the booking is declined or you cancel.</p>
    </div>
  );
}

function BookingForm({ parent }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [serviceType, setServiceType] = useState(BOOKING_SERVICES[0].value);
  const [currency, setCurrency] = useState(() => detectCurrency(user));
  const [chosenCaregiver, setChosenCaregiver] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [quote, setQuote] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const service = BOOKING_SERVICES.find(({ value }) => value === serviceType);
  const query = new URLSearchParams({ ...parent.location, radius: '50' });
  if (service.caregiverService) query.set('service', service.caregiverService);
  const nearby = useApi(`/caregivers/nearby?${query}`);

  useEffect(() => {
    let ignore = false;

    api
      .post('/bookings/quote', { parentId: parent.id, serviceType, currency })
      .then((res) => {
        if (!ignore) setQuote(res.data.quote);
      })
      .catch((err) => {
        if (!ignore) setFormError(getErrorMessage(err));
      });

    return () => {
      ignore = true;
    };
  }, [parent.id, serviceType, currency]);

  const caregivers = nearby.data?.caregivers ?? [];
  const primary = caregivers.find(({ id }) => id === parent.primaryCaregiver?.id);
  const stillListed = caregivers.some(({ id }) => id === chosenCaregiver);
  const caregiverId = (stillListed && chosenCaregiver) || primary?.id || caregivers[0]?.id || '';

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    const clientErrors = {};
    if (!caregiverId) clientErrors.caregiverId = 'Choose a caregiver';
    if (!scheduledAt) clientErrors.scheduledAt = 'Choose a date and time';
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await api.post('/bookings', {
        parentId: parent.id,
        caregiverId,
        serviceType,
        currency,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes,
      });
      navigate('/bookings', { state: { notice: `${service.label} requested for ${parent.name}.` } });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5">
      <FormAlert>{formError}</FormAlert>

      <div>
        <label htmlFor="service" className="block font-semibold">
          What do you need?
        </label>
        <select
          id="service"
          value={serviceType}
          onChange={(event) => setServiceType(event.target.value)}
          className={SELECT_CLASS}
        >
          {BOOKING_SERVICES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="caregiver" className="block font-semibold">
          Who should do it?
        </label>
        {nearby.error ? (
          <LoadError message={nearby.error} onRetry={nearby.reload} />
        ) : (
          <select
            id="caregiver"
            value={caregiverId}
            onChange={(event) => setChosenCaregiver(event.target.value)}
            aria-invalid={errors.caregiverId ? 'true' : undefined}
            aria-describedby={errors.caregiverId ? 'caregiver-error' : undefined}
            className={SELECT_CLASS}
          >
            {caregivers.length === 0 && <option value="">Nobody nearby offers this yet</option>}
            {caregivers.map(({ id, name, distanceKm }) => (
              <option key={id} value={id}>
                {name}, {distanceKm} km away{id === parent.primaryCaregiver?.id ? ' (your caregiver)' : ''}
              </option>
            ))}
          </select>
        )}
        {errors.caregiverId && (
          <p id="caregiver-error" className="mt-1.5 text-base font-medium text-danger">
            {errors.caregiverId}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="scheduledAt" className="block font-semibold">
          When?
        </label>
        <p id="scheduledAt-hint" className="text-base text-ink-soft">
          In your own time zone
          {serviceType === 'emergency_visit' ? '.' : ', at least 1 hour from now.'}
        </p>
        <input
          id="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
          aria-invalid={errors.scheduledAt ? 'true' : undefined}
          aria-describedby={`scheduledAt-hint${errors.scheduledAt ? ' scheduledAt-error' : ''}`}
          className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2"
        />
        {errors.scheduledAt && (
          <p id="scheduledAt-error" className="mt-1.5 text-base font-medium text-danger">
            {errors.scheduledAt}
          </p>
        )}
      </div>

      <FormTextarea
        label="Notes for the caregiver (optional)"
        rows={3}
        name="notes"
        value={notes}
        error={errors.notes}
        onChange={(event) => setNotes(event.target.value)}
      />

      <Toggle legend="Currency" value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} />
      <PriceSummary quote={quote} />

      {quote && !quote.includedIn && (
        <p className="rounded-xl bg-sand px-4 py-3">
          <strong>Test checkout.</strong> This is a demo, so no real money is taken.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting || !quote} className="btn btn-primary">
          {submitting && 'Booking…'}
          {!submitting &&
            (!quote || quote.includedIn
              ? 'Request this visit'
              : `Pay ${formatMoney(quote.total, quote.currency)} and request`)}
        </button>
        <Link to="/parents" className="btn btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

export default function BookService() {
  usePageTitle('Book a service');
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/parents/${id}`);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const { parent } = data;
    if (!parent.location) {
      return (
        <div className="mt-6 rounded-xl bg-sand px-4 py-3">
          <p>Add {parent.name}'s address and map pin first, so we can find someone nearby.</p>
          <Link to={`/parents/${parent.id}/edit`} className="text-link">
            Add details
          </Link>
        </div>
      );
    }

    return (
      <>
        <p className="mt-2 text-ink-soft">For {parent.name}.</p>
        <BookingForm parent={parent} />
      </>
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Book a service</h1>
      {content()}
    </div>
  );
}
