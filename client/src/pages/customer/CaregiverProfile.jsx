import { useState } from 'react';
import { Phone, Star } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, getErrorMessage } from '../../api/client';
import { CaregiverAvatar, Rating, TrustBadges } from '../../components/CaregiverBits';
import FormAlert from '../../components/FormAlert';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { dayLabel, serviceLabel } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/format';

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function ChooseButton({ caregiver, parentId }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post(`/parents/${parentId}/assign`, { caregiverId: caregiver.id });
      navigate('/parents', {
        state: { notice: `Request sent to ${caregiver.name}. We will notify you of their answer.` },
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 space-y-3">
      <FormAlert>{error}</FormAlert>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={busy} onClick={choose} className="btn btn-primary">
          {busy ? 'Sending…' : 'Choose as primary caregiver'}
        </button>
        <Link to={`/parents/${parentId}/caregivers`} className="btn btn-secondary">
          Back to the list
        </Link>
      </div>
    </div>
  );
}

export default function CaregiverProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parent');
  const { data, loading, error, reload } = useApi(`/caregivers/${id}`);
  const caregiver = data?.caregiver;
  usePageTitle(caregiver?.name ?? 'Caregiver');

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="flex flex-wrap items-center gap-5">
        <CaregiverAvatar caregiver={caregiver} size={96} />
        <div>
          <h1 className="text-4xl">{caregiver.name}</h1>
          <TrustBadges policeVerified={caregiver.policeVerified} />
          <p className="mt-1">
            <Rating ratingAvg={caregiver.ratingAvg} ratingCount={caregiver.ratingCount} />
          </p>
        </div>
      </div>

      {caregiver.bio && <p className="mt-6 text-xl">{caregiver.bio}</p>}

      <Section title="Contact">
        {caregiver.phone ? (
          <a href={`tel:${caregiver.phone}`} className="text-link inline-flex items-center gap-2">
            <Phone aria-hidden="true" size={18} />
            {caregiver.phone}
          </a>
        ) : (
          <p className="text-ink-soft">
            Their phone number is shared once they have accepted your request.
          </p>
        )}
      </Section>

      <Section title="Experience">
        <p>
          {caregiver.experienceYears} years in {caregiver.area || 'elder care'}. Covers{' '}
          {caregiver.serviceRadiusKm} km around their area.
        </p>
        <p className="text-ink-soft">Speaks {caregiver.languages.join(', ')}.</p>
      </Section>

      <Section title="Services">
        <ul className="list-disc pl-6">
          {caregiver.services.map((service) => (
            <li key={service}>{serviceLabel(service)}</li>
          ))}
        </ul>
      </Section>

      {caregiver.certificates.length > 0 && (
        <Section title="Certificates">
          <ul className="list-disc pl-6">
            {caregiver.certificates.map((certificate) => (
              <li key={certificate}>{certificate}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Weekly availability">
        <dl className="divide-y divide-line border-y border-line">
          {caregiver.availability.map(({ day, start, end }) => (
            <div key={day} className="flex justify-between gap-4 py-2">
              <dt>{dayLabel(day)}</dt>
              <dd className="text-ink-soft">
                {start} to {end}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {caregiver.reviews.length > 0 && (
        <Section title="What families say">
          <ul className="space-y-3">
            {caregiver.reviews.map((review) => (
              <li key={review.id} className="rounded-xl border border-line bg-white p-4">
                <p className="flex items-center gap-1">
                  <Star aria-hidden="true" size={18} className="fill-marigold text-marigold" />
                  <strong>{review.rating} out of 5</strong>
                </p>
                {review.comment && <p className="mt-1">{review.comment}</p>}
                <p className="text-base text-ink-soft">
                  {review.author}, {formatDate(review.date)}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {parentId && <ChooseButton caregiver={caregiver} parentId={parentId} />}
    </div>
  );
}
