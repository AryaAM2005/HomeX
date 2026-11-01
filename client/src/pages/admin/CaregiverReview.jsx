import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, apiUrl, getErrorMessage, getFieldErrors } from '../../api/client';
import { CaregiverAvatar } from '../../components/CaregiverBits';
import FormAlert from '../../components/FormAlert';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { dayLabel, DOCUMENT_GROUPS, serviceLabel } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';

function Decision({ caregiver }) {
  const navigate = useNavigate();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (body) => {
    setBusy(true);
    setError('');
    setReasonError('');
    try {
      await api.patch(`/admin/caregivers/${caregiver.id}`, body);
      navigate('/admin/caregivers');
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.reason) setReasonError(fields.reason);
      else setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  if (caregiver.status === 'draft') {
    return <p className="mt-8 text-ink-soft">This caregiver has not submitted their profile yet.</p>;
  }

  return (
    <div className="mt-8 space-y-3">
      <FormAlert>{error}</FormAlert>
      {rejecting ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            decide({ action: 'reject', reason });
          }}
          noValidate
          className="space-y-3 rounded-2xl bg-sand p-5"
        >
          <FormTextarea
            label="Why are you rejecting this?"
            hint="The caregiver sees this, so say what they need to fix."
            name="reason"
            value={reason}
            error={reasonError}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn bg-danger text-white">
              Reject
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="btn btn-secondary">
              Go back
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-3">
          {caregiver.status !== 'approved' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => decide({ action: 'approve' })}
              className="btn btn-primary"
            >
              Approve
            </button>
          )}
          {caregiver.status !== 'rejected' && (
            <button type="button" onClick={() => setRejecting(true)} className="btn btn-secondary">
              {caregiver.status === 'approved' ? 'Remove approval' : 'Reject'}
            </button>
          )}
        </div>
      )}
    </div>
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

export default function CaregiverReview() {
  usePageTitle('Review caregiver');
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/admin/caregivers/${id}`);

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <LoadError message={error} onRetry={reload} />
      </div>
    );
  }

  const { caregiver } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <Link to="/admin/caregivers" className="text-link">
        Back to verification
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <CaregiverAvatar caregiver={caregiver} size={80} />
        <div className="min-w-0">
          <h1 className="text-4xl">{caregiver.name}</h1>
          <p className="break-all text-ink-soft">
            {caregiver.email}, {caregiver.phone}
          </p>
        </div>
      </div>

      {caregiver.rejectionReason && (
        <p className="mt-4 rounded-xl bg-sand px-4 py-3">
          <strong>Rejected:</strong> {caregiver.rejectionReason}
        </p>
      )}

      <h2 className="mt-8 text-2xl">Documents</h2>
      {caregiver.documents.length === 0 ? (
        <p className="mt-2 text-ink-soft">No documents on file.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {DOCUMENT_GROUPS.map((group) => (
            <li key={group.type}>
              <p className="font-semibold">{group.label}</p>
              <ul>
                {caregiver.documents
                  .filter(({ type }) => type === group.type)
                  .map((document) => (
                    <li key={document.id}>
                      <a
                        href={apiUrl(`/caregivers/${caregiver.id}/documents/${document.id}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-link inline-flex items-center gap-2 break-all"
                      >
                        {document.name}
                        <ExternalLink aria-hidden="true" size={16} className="shrink-0" />
                      </a>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-2xl">Profile</h2>
      <dl className="mt-3 space-y-3">
        <Detail label="Bio">{caregiver.bio || 'Not added'}</Detail>
        <Detail label="Experience">{caregiver.experienceYears} years</Detail>
        <Detail label="Services">{caregiver.services.map(serviceLabel).join(', ') || 'None'}</Detail>
        <Detail label="Languages">{caregiver.languages.join(', ') || 'None'}</Detail>
        <Detail label="Training">{caregiver.certificates.join(', ') || 'None listed'}</Detail>
        <Detail label="Area">
          {caregiver.area || 'Not added'}, covering {caregiver.serviceRadiusKm} km
        </Detail>
        <Detail label="Availability">
          {caregiver.availability
            .map(({ day, start, end }) => `${dayLabel(day)} ${start} to ${end}`)
            .join(', ') || 'None'}
        </Detail>
      </dl>

      <Decision caregiver={caregiver} />
    </div>
  );
}
