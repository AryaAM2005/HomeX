import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CaregiverAvatar, Rating, TrustBadges } from '../../components/CaregiverBits';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { CaregiverMap } from '../../components/Maps';
import { LANGUAGES, SERVICE_OPTIONS, serviceLabel, WEEKDAYS } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';

const SELECT_CLASS = 'mt-1 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2';

function Filter({ label, value, onChange, children }) {
  return (
    <label className="block">
      <span className="font-semibold">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={SELECT_CLASS}>
        {children}
      </select>
    </label>
  );
}

function CaregiverCard({ caregiver, parentId }) {
  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex gap-4">
        <CaregiverAvatar caregiver={caregiver} />
        <div className="min-w-0">
          <h2 className="text-2xl">{caregiver.name}</h2>
          <TrustBadges policeVerified={caregiver.policeVerified} />
        </div>
      </div>
      <p className="mt-3">
        <strong>{caregiver.distanceKm} km away</strong>
        {caregiver.area && <span className="text-ink-soft"> in {caregiver.area}</span>}
      </p>
      <p>
        <Rating ratingAvg={caregiver.ratingAvg} ratingCount={caregiver.ratingCount} />
      </p>
      <p className="text-ink-soft">
        {caregiver.experienceYears} years of experience. Speaks {caregiver.languages.join(', ')}.
      </p>
      <p className="mt-1 text-ink-soft">{caregiver.services.map(serviceLabel).join(', ')}</p>
      <Link to={`/caregivers/${caregiver.id}?parent=${parentId}`} className="btn btn-secondary mt-4">
        View profile
      </Link>
    </li>
  );
}

function Results({ parent }) {
  const [radius, setRadius] = useState('10');
  const [service, setService] = useState('');
  const [minRating, setMinRating] = useState('');
  const [day, setDay] = useState('');
  const [language, setLanguage] = useState('');

  const query = new URLSearchParams({ ...parent.location, radius });
  Object.entries({ service, minRating, day, language }).forEach(([name, value]) => {
    if (value) query.set(name, value);
  });

  const { data, error, loading, reload } = useApi(`/caregivers/nearby?${query}`);

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Filter label="Distance" value={radius} onChange={setRadius}>
          {['5', '10', '25', '50'].map((km) => (
            <option key={km} value={km}>
              Within {km} km
            </option>
          ))}
        </Filter>
        <Filter label="Service" value={service} onChange={setService}>
          <option value="">Any service</option>
          {SERVICE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Filter>
        <Filter label="Rating" value={minRating} onChange={setMinRating}>
          <option value="">Any rating</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </Filter>
        <Filter label="Available on" value={day} onChange={setDay}>
          <option value="">Any day</option>
          {WEEKDAYS.map((weekday) => (
            <option key={weekday.value} value={weekday.value}>
              {weekday.label}
            </option>
          ))}
        </Filter>
        <Filter label="Language" value={language} onChange={setLanguage}>
          <option value="">Any language</option>
          {LANGUAGES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Filter>
      </div>

      {error && (
        <div className="mt-6">
          <LoadError message={error} onRetry={reload} />
        </div>
      )}
      {loading && <Loading />}

      {data && (
        <>
          <p role="status" className="mt-6 font-semibold">
            {data.caregivers.length === 1
              ? '1 verified caregiver found'
              : `${data.caregivers.length} verified caregivers found`}
          </p>
          <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="lg:sticky lg:top-32 lg:self-start">
              <CaregiverMap
                home={parent.location}
                homeName={parent.name}
                radiusKm={Number(radius)}
                caregivers={data.caregivers}
                profileLink={(caregiver) => `/caregivers/${caregiver.id}?parent=${parent.id}`}
              />
            </div>
            {data.caregivers.length === 0 ? (
              <p className="text-ink-soft">
                Nobody matches these filters. Try a wider distance or fewer filters.
              </p>
            ) : (
              <ul className="space-y-4">
                {data.caregivers.map((caregiver) => (
                  <CaregiverCard key={caregiver.id} caregiver={caregiver} parentId={parent.id} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function ChooseCaregiver() {
  usePageTitle('Choose a caregiver');
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/parents/${id}`);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const { parent } = data;
    if (!parent.location) {
      return (
        <div className="mt-6 rounded-xl bg-sand px-4 py-3">
          <p>Add {parent.name}'s address and map pin first, so we can search near their home.</p>
          <Link to={`/parents/${parent.id}/edit`} className="text-link">
            Add details
          </Link>
        </div>
      );
    }

    return (
      <>
        <p className="mt-2 text-ink-soft">
          Verified caregivers near {parent.name}'s home, nearest first. Pick one person, so your
          parent sees the same familiar face.
        </p>
        <Results parent={parent} />
      </>
    );
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Choose a caregiver</h1>
      {content()}
    </div>
  );
}
