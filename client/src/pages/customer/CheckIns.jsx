import { useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { apiUrl } from '../../api/client';
import { useLiveEvents } from '../../api/socket';
import CheckInCalendar from '../../components/CheckInCalendar';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import VitalsCharts from '../../components/VitalsCharts';
import { moodLabel } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDateTime, indiaDate } from '../../utils/format';

const NEAR_HOME_METRES = 300;

function shiftMonth(month, change) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + change, 1)).toISOString().slice(0, 7);
}

function monthName(month) {
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function vitalsText({ bpSystolic, bpDiastolic, sugar, pulse, temperature }) {
  return [
    bpSystolic != null && `BP ${bpSystolic}/${bpDiastolic ?? '?'}`,
    sugar != null && `Sugar ${sugar}`,
    pulse != null && `Pulse ${pulse}`,
    temperature != null && `Temp ${temperature}°F`,
  ]
    .filter(Boolean)
    .join(', ');
}

function gpsText(distance) {
  if (distance === null) return null;
  if (distance <= NEAR_HOME_METRES) return 'GPS confirms this was at home';
  return `GPS shows ${(distance / 1000).toFixed(1)} km from home`;
}

function CheckInCard({ checkIn }) {
  const vitals = vitalsText(checkIn.vitals);
  const gps = gpsText(checkIn.distanceFromHomeM);

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="font-sans text-xl font-semibold">
          {checkIn.type === 'visit' ? 'Home visit' : 'Phone call'}
        </h3>
        <p className="text-ink-soft">{formatDateTime(checkIn.time)}</p>
      </div>
      <p className="text-ink-soft">By {checkIn.caregiverName}</p>
      <p className="mt-2">
        <strong>Mood:</strong> {moodLabel(checkIn.mood)}
      </p>
      {vitals && (
        <p>
          <strong>Vitals:</strong> {vitals}
        </p>
      )}
      {checkIn.medicines.length > 0 && (
        <ul className="mt-1">
          {checkIn.medicines.map(({ name, time, status }) => (
            <li key={`${name}-${time}`}>
              {name} at {time}: <strong>{status === 'given' ? 'Given' : 'Missed'}</strong>
            </li>
          ))}
        </ul>
      )}
      {checkIn.notes && <p className="mt-1">{checkIn.notes}</p>}
      {gps && (
        <p className="mt-1 flex items-center gap-1 text-ink-soft">
          <MapPin aria-hidden="true" size={18} />
          {gps}
        </p>
      )}
      {checkIn.hasPhoto && (
        <img
          src={apiUrl(`/checkins/${checkIn.id}/photo`)}
          alt={`Photo from the visit on ${formatDateTime(checkIn.time)}`}
          loading="lazy"
          className="mt-3 max-h-64 rounded-xl object-cover"
        />
      )}
    </li>
  );
}

export default function CheckIns() {
  usePageTitle('Check-in history');
  const { id } = useParams();
  const [today] = useState(() => indiaDate());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(null);
  const { data, loading, error, reload } = useApi(`/parents/${id}/checkins?month=${month}`);
  useLiveEvents(['checkin:new'], reload);

  const goToMonth = (change) => {
    setSelectedDay(null);
    setMonth(shiftMonth(month, change));
  };

  const content = () => {
    if (!data && loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const shown = selectedDay
      ? data.checkIns.filter(({ date }) => date === selectedDay)
      : data.checkIns;

    return (
      <>
        <h1 className="mt-2 text-4xl">{data.parent.name}'s check-ins</h1>

        {data.latest ? (
          <p className="mt-2 text-xl">
            Latest: {formatDateTime(data.latest.time)} by {data.latest.caregiverName}. Mood:{' '}
            {moodLabel(data.latest.mood)}.
          </p>
        ) : (
          <p className="mt-2 text-ink-soft">No check-ins have been logged yet.</p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="grid size-12 place-items-center rounded-lg"
          >
            <ChevronLeft aria-hidden="true" size={28} />
          </button>
          <h2 className="text-2xl">{monthName(month)}</h2>
          <button
            type="button"
            onClick={() => goToMonth(1)}
            disabled={month >= today.slice(0, 7)}
            aria-label="Next month"
            className="grid size-12 place-items-center rounded-lg disabled:opacity-40"
          >
            <ChevronRight aria-hidden="true" size={28} />
          </button>
        </div>

        <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_16rem]">
          <CheckInCalendar
            month={month}
            today={today}
            checkIns={data.checkIns}
            selected={selectedDay}
            onSelect={setSelectedDay}
          />
          <dl className="grid content-start gap-4">
            <div className="rounded-2xl bg-sand p-5">
              <dt className="text-ink-soft">Check-ins this month</dt>
              <dd className="font-display text-4xl font-semibold">{data.checkIns.length}</dd>
            </div>
            <div className="rounded-2xl bg-sand p-5">
              <dt className="text-ink-soft">Medicine doses given this month</dt>
              <dd className="font-display text-4xl font-semibold">
                {data.adherencePct === null ? 'None logged' : `${data.adherencePct}%`}
              </dd>
            </div>
          </dl>
        </div>

        <h2 className="mt-10 text-3xl">Vitals, last 30 days</h2>
        <VitalsCharts readings={data.recentVitals} />

        <h2 className="mt-10 text-3xl">
          {selectedDay ? `Check-ins on ${selectedDay}` : 'All check-ins this month'}
        </h2>
        {shown.length === 0 ? (
          <p className="mt-2 text-ink-soft">None this month.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {shown.map((checkIn) => (
              <CheckInCard key={checkIn.id} checkIn={checkIn} />
            ))}
          </ul>
        )}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Link to="/parents" className="text-link">
        Back to My Parents
      </Link>
      {content()}
    </div>
  );
}
