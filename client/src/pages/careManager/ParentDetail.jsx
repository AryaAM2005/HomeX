import { Link, useParams } from 'react-router';
import { useLiveEvents } from '../../api/live';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import ReassignCaregiver from '../../components/ReassignCaregiver';
import VitalsCharts from '../../components/VitalsCharts';
import { moodLabel } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate, formatDateTime } from '../../utils/format';

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Person({ label, person }) {
  return (
    <p>
      <span className="text-ink-soft">{label}:</span>{' '}
      {person ? (
        <>
          <strong>{person.name}</strong>{' '}
          <a href={`tel:${person.phone}`} className="text-link whitespace-nowrap">
            {person.phone}
          </a>
        </>
      ) : (
        'Not assigned'
      )}
    </p>
  );
}

function HealthHistory({ parentId }) {
  const checkIns = useApi(`/parents/${parentId}/checkins`);
  const medicines = useApi(`/parents/${parentId}/medicines`);
  const reports = useApi(`/parents/${parentId}/reports`);
  useLiveEvents(['checkin:new'], checkIns.reload);

  const failure = checkIns.error || medicines.error || reports.error;
  if (failure) return <LoadError message={failure} onRetry={checkIns.reload} />;
  if (!checkIns.data || !medicines.data || !reports.data) return <Loading />;

  const active = medicines.data.medicines.filter(({ activeToday }) => activeToday);
  const [latestWellness] = reports.data.wellnessReports;

  return (
    <>
      <Section title="Vitals, last 30 days">
        <VitalsCharts readings={checkIns.data.recentVitals} />
      </Section>

      <Section title="Check-ins this month">
        {checkIns.data.checkIns.length === 0 ? (
          <p className="text-ink-soft">None this month.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {checkIns.data.checkIns.slice(0, 10).map((checkIn) => (
              <li key={checkIn.id} className="py-2">
                <strong>{formatDateTime(checkIn.time)}</strong>,{' '}
                {checkIn.type === 'visit' ? 'home visit' : 'phone call'} by {checkIn.caregiverName}.
                Mood: {moodLabel(checkIn.mood)}.{checkIn.notes && ` ${checkIn.notes}`}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Medicines">
        {active.length === 0 ? (
          <p className="text-ink-soft">None active today.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((medicine) => (
              <li key={medicine.id}>
                <strong>{medicine.name}</strong>, {medicine.dose}.{' '}
                {medicine.todayDoses
                  .map(({ time, status }) => `${time}: ${status ?? 'not logged'}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Reports">
        {latestWellness ? (
          <p>
            <strong>Week of {formatDate(latestWellness.weekStart)}:</strong> {latestWellness.summary}
          </p>
        ) : (
          <p className="text-ink-soft">No wellness report yet.</p>
        )}
        {reports.data.careReports.slice(0, 5).map((report) => (
          <p key={report.id} className="mt-2">
            <strong>
              {report.service}, {formatDate(report.visitDate)}:
            </strong>{' '}
            {report.diagnosisSummary}
          </p>
        ))}
      </Section>
    </>
  );
}

export default function ParentDetail() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/caremanager/parents/${id}`);
  const parent = data?.parent;
  usePageTitle(parent?.name ?? 'Parent');

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    return (
      <>
        <h1 className="mt-2 text-4xl">
          {parent.name}
          {parent.age && <span className="font-sans text-2xl text-ink-soft">, {parent.age}</span>}
        </h1>
        <p className="text-ink-soft">{parent.address || 'No address yet'}</p>
        <p className="font-medium">{parent.planName ? `${parent.planName} plan` : 'No plan'}</p>

        <Section title="Health">
          <p>
            <span className="text-ink-soft">Conditions:</span>{' '}
            {parent.conditions.join(', ') || 'None listed'}
          </p>
          <p>
            <span className="text-ink-soft">Allergies:</span>{' '}
            {parent.allergies.join(', ') || 'None listed'}
          </p>
        </Section>

        <Section title="Family">
          {parent.family && <Person label="Family" person={parent.family} />}
          {parent.family?.timezone && (
            <p className="text-ink-soft">Time zone: {parent.family.timezone}</p>
          )}
          <Person label="Emergency contact" person={parent.emergencyContact} />
        </Section>

        <Section title="Caregivers">
          <Person label="Primary" person={parent.primaryCaregiver} />
          <Person label="Backup" person={parent.backupCaregiver} />
          <ReassignCaregiver parent={parent} onChanged={reload} />
        </Section>

        <HealthHistory parentId={parent.id} />
      </>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <Link to="/care-manager" className="text-link">
        Back to My Families
      </Link>
      {content()}
    </div>
  );
}
