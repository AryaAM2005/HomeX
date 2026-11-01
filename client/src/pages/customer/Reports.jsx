import { useState } from 'react';
import { FileText, MessageCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { apiUrl } from '../../api/client';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import Toggle from '../../components/Toggle';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatDate } from '../../utils/format';

const VIEW_OPTIONS = [
  { value: 'wellness', label: 'Weekly wellness' },
  { value: 'care', label: 'Care reports' },
];

const MEASURES = [
  { key: 'bpSystolic', label: 'BP, upper', unit: 'mmHg' },
  { key: 'bpDiastolic', label: 'BP, lower', unit: 'mmHg' },
  { key: 'sugar', label: 'Blood sugar', unit: 'mg/dL' },
  { key: 'pulse', label: 'Pulse', unit: 'bpm' },
  { key: 'temperature', label: 'Temperature', unit: '°F' },
];

function changeText(change) {
  if (change === null || change === undefined) return 'No earlier week to compare';
  if (change === 0) return 'Same as last week';
  return `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} from last week`;
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

function shareLink(parentName, report) {
  const message = `${parentName}'s HOMEX wellness report, ${report.weekStart} to ${report.weekEnd}. ${report.summary}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function WellnessCard({ parentName, report }) {
  const measures = MEASURES.filter(({ key }) => report.vitalsTrend[key]);

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-2xl">
        {formatDate(report.weekStart)} to {formatDate(report.weekEnd)}
      </h2>
      <p className="mt-2 text-xl">{report.summary}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-sand p-4">
          <dt className="text-ink-soft">Check-ins</dt>
          <dd className="font-display text-3xl font-semibold">
            {report.checkinCount} of {report.expectedCheckins}
          </dd>
        </div>
        <div className="rounded-xl bg-sand p-4">
          <dt className="text-ink-soft">Doses given</dt>
          <dd className="font-display text-3xl font-semibold">
            {report.adherencePct === null ? 'None logged' : `${report.adherencePct}%`}
          </dd>
        </div>
        <div className="rounded-xl bg-sand p-4">
          <dt className="text-ink-soft">Alerts</dt>
          <dd className="font-display text-3xl font-semibold">{report.alertCount}</dd>
        </div>
      </dl>

      {measures.length > 0 && (
        <table className="mt-4 w-full border-collapse text-left">
          <caption className="sr-only">Average vitals for the week</caption>
          <thead>
            <tr className="border-b-2 border-line">
              <th scope="col" className="py-2 pr-3 font-semibold">
                Vital
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                Average
              </th>
              <th scope="col" className="py-2 font-semibold">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            {measures.map(({ key, label, unit }) => (
              <tr key={key} className="border-b border-line align-top">
                <th scope="row" className="py-2 pr-3 font-normal">
                  {label}
                </th>
                <td className="py-2 pr-3">
                  {report.vitalsTrend[key].avg} {unit}
                </td>
                <td className="py-2 text-ink-soft">{changeText(report.vitalsTrend[key].change)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <a
        href={shareLink(parentName, report)}
        target="_blank"
        rel="noreferrer"
        className="btn btn-secondary mt-4"
      >
        <MessageCircle aria-hidden="true" size={20} />
        Share on WhatsApp
      </a>
    </li>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-base text-ink-soft">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function CareReportCard({ report }) {
  const vitals = vitalsText(report.vitals);

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 className="text-2xl">{report.service}</h2>
        <p className="text-ink-soft">{formatDate(report.visitDate)}</p>
      </div>
      <p className="text-ink-soft">Filed by {report.caregiverName}</p>

      <dl className="mt-3 space-y-2">
        <Detail label="Doctor or lab">
          {report.doctorName}
          {report.hospital && `, ${report.hospital}`}
        </Detail>
        <Detail label="What they said">{report.diagnosisSummary}</Detail>
        {vitals && <Detail label="Vitals">{vitals}</Detail>}
        {report.prescriptions && <Detail label="Prescriptions">{report.prescriptions}</Detail>}
        {report.nextFollowUp && (
          <Detail label="Next follow-up">{formatDate(report.nextFollowUp)}</Detail>
        )}
        {report.notes && <Detail label="Notes">{report.notes}</Detail>}
      </dl>

      {report.attachments.length > 0 && (
        <ul className="mt-3 space-y-1">
          {report.attachments.map((attachment) => (
            <li key={attachment.id}>
              <a
                href={apiUrl(`/reports/${report.id}/attachments/${attachment.id}`)}
                target="_blank"
                rel="noreferrer"
                className="text-link inline-flex items-center gap-2 break-all"
              >
                <FileText aria-hidden="true" size={18} className="shrink-0" />
                {attachment.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Reports() {
  usePageTitle('Reports');
  const { id } = useParams();
  const [view, setView] = useState('wellness');
  const { data, loading, error, reload } = useApi(`/parents/${id}/reports`);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const { parent, wellnessReports, careReports } = data;

    return (
      <>
        <h1 className="mt-2 text-4xl">{parent.name}'s reports</h1>
        <div className="mt-6">
          <Toggle legend="Show reports" value={view} onChange={setView} options={VIEW_OPTIONS} />
        </div>

        {view === 'wellness' &&
          (wellnessReports.length === 0 ? (
            <p className="mt-6 text-ink-soft">
              The first report arrives on the Monday after a full week of care.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {wellnessReports.map((report) => (
                <WellnessCard key={report.id} parentName={parent.name} report={report} />
              ))}
            </ul>
          ))}

        {view === 'care' &&
          (careReports.length === 0 ? (
            <p className="mt-6 text-ink-soft">Reports appear here after each doctor or lab visit.</p>
          ) : (
            <ul className="mt-6 space-y-4">
              {careReports.map((report) => (
                <CareReportCard key={report.id} report={report} />
              ))}
            </ul>
          ))}
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link to="/parents" className="text-link">
        Back to My Parents
      </Link>
      {content()}
    </div>
  );
}
