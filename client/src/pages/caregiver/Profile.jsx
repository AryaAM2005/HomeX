import { useState } from 'react';
import { ExternalLink, Trash2, Upload } from 'lucide-react';
import { api, apiUrl, getErrorMessage } from '../../api/client';
import { CaregiverAvatar } from '../../components/CaregiverBits';
import CheckboxGroup from '../../components/CheckboxGroup';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import FormTextarea from '../../components/FormTextarea';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import VerificationStatus from '../../components/VerificationStatus';
import { useAuth } from '../../context/useAuth';
import { DOCUMENT_GROUPS, LANGUAGES, SERVICE_OPTIONS } from '../../data/care';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { shrinkImage } from '../../utils/shrinkImage';
import { compact } from '../../utils/validators';

const LANGUAGE_OPTIONS = LANGUAGES.map((language) => ({ value: language, label: language }));

function FileButton({ label, accept, disabled, onFile }) {
  return (
    <label
      className={`btn btn-secondary cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      <Upload aria-hidden="true" size={20} />
      {disabled ? 'Uploading…' : label}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          const [file] = event.target.files;
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

function useUpload(url, onDone) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file, fields = {}) => {
    const body = new FormData();
    Object.entries(fields).forEach(([name, value]) => body.append(name, value));

    setBusy(true);
    setError('');
    try {
      body.append('file', await shrinkImage(file));
      await api.post(url, body);
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, upload };
}

function PhotoSection({ profile, onChanged }) {
  const { user } = useAuth();
  const { busy, error, upload } = useUpload('/caregivers/me/photo', onChanged);

  return (
    <section className="mt-8">
      <h2 className="text-2xl">Your photo</h2>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <CaregiverAvatar caregiver={{ ...profile, id: user.id, name: user.name }} size={80} />
        <FileButton
          label={profile.hasPhoto ? 'Change photo' : 'Add a photo'}
          accept="image/jpeg,image/png"
          disabled={busy}
          onFile={upload}
        />
      </div>
      <div className="mt-2">
        <FormAlert>{error}</FormAlert>
      </div>
    </section>
  );
}

function AboutForm({ profile, onSaved }) {
  const [saved, setSaved] = useState(false);

  const { values, errors, field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: {
      bio: profile.bio,
      experienceYears: String(profile.experienceYears),
      services: profile.services,
      languages: profile.languages,
      certificates: profile.certificates.join(', '),
    },
    validate: (form) => {
      const years = Number(form.experienceYears);

      return compact({
        bio: form.bio.trim().length < 20 ? 'Write at least 20 characters' : undefined,
        experienceYears:
          Number.isInteger(years) && years >= 0 && years <= 60 ? undefined : 'Enter a number of years',
        services: form.services.length === 0 ? 'Choose at least one service' : undefined,
        languages: form.languages.length === 0 ? 'Choose at least one language' : undefined,
      });
    },
    onSubmit: async (form) => {
      setSaved(false);
      await api.put('/caregivers/me', {
        ...form,
        experienceYears: Number(form.experienceYears),
        certificates: form.certificates
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setSaved(true);
      onSaved();
    },
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-10 space-y-5">
      <h2 className="text-2xl">About you</h2>
      <FormAlert>{formError}</FormAlert>
      <FormTextarea
        label="A short bio"
        hint="Families read this when choosing a caregiver."
        {...field('bio')}
      />
      <FormField label="Years of experience" inputMode="numeric" {...field('experienceYears')} />
      <CheckboxGroup
        legend="Services you offer"
        name="services"
        options={SERVICE_OPTIONS}
        values={values.services}
        error={errors.services}
        onChange={(services) => setValue('services', services)}
      />
      <CheckboxGroup
        legend="Languages you speak"
        name="languages"
        options={LANGUAGE_OPTIONS}
        values={values.languages}
        error={errors.languages}
        onChange={(languages) => setValue('languages', languages)}
      />
      <FormField
        label="Training courses (optional)"
        hint="Separate them with commas. These appear on your public profile."
        {...field('certificates')}
      />
      <FormAlert tone="success">{saved ? 'Your details have been saved.' : ''}</FormAlert>
      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

function DocumentGroup({ group, profile, ownerId, onChanged }) {
  const { busy, error, upload } = useUpload('/caregivers/me/documents', onChanged);
  const [deleteError, setDeleteError] = useState('');
  const documents = profile.documents.filter(({ type }) => type === group.type);

  const remove = async (documentId) => {
    setDeleteError('');
    try {
      await api.delete(`/caregivers/me/documents/${documentId}`);
      onChanged();
    } catch (err) {
      setDeleteError(getErrorMessage(err));
    }
  };

  return (
    <li className="rounded-2xl border border-line bg-white p-5">
      <h3 className="font-sans text-xl font-semibold">{group.label}</h3>
      <p className="text-ink-soft">{group.hint}</p>
      {documents.length > 0 && (
        <ul className="mt-2 divide-y divide-line">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center justify-between gap-3 py-2">
              <a
                href={apiUrl(`/caregivers/${ownerId}/documents/${document.id}`)}
                target="_blank"
                rel="noreferrer"
                className="text-link inline-flex min-w-0 items-center gap-2 break-all"
              >
                {document.name}
                <ExternalLink aria-hidden="true" size={16} className="shrink-0" />
              </a>
              <button
                type="button"
                onClick={() => remove(document.id)}
                aria-label={`Delete ${document.name}`}
                className="grid size-11 shrink-0 place-items-center rounded-lg text-danger"
              >
                <Trash2 aria-hidden="true" size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <FileButton
          label="Upload"
          accept="application/pdf,image/jpeg,image/png"
          disabled={busy}
          onFile={(file) => upload(file, { type: group.type })}
        />
      </div>
      <div className="mt-2">
        <FormAlert>{error || deleteError}</FormAlert>
      </div>
    </li>
  );
}

function SubmitSection({ profile, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!['draft', 'rejected'].includes(profile.verificationStatus)) return null;

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api.post('/caregivers/me/submit');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl bg-sand p-5">
      <h2 className="text-2xl">Ready to be verified?</h2>
      <p className="mt-1 text-ink-soft">
        HOMEX will check your documents. Once approved, families near you can find you.
      </p>
      <div className="mt-3">
        <FormAlert>{error}</FormAlert>
      </div>
      <button
        type="button"
        disabled={busy || profile.missing.length > 0}
        onClick={submit}
        className="btn btn-primary mt-3"
      >
        {busy ? 'Submitting…' : 'Submit for verification'}
      </button>
      {profile.missing.length > 0 && (
        <p className="mt-2 text-ink-soft">Complete the list at the top of this page first.</p>
      )}
    </section>
  );
}

export default function CaregiverProfilePage() {
  usePageTitle('Profile & Documents');
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/caregivers/me');

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;

    const { profile } = data;

    return (
      <>
        <VerificationStatus profile={profile} />
        <PhotoSection profile={profile} onChanged={reload} />
        <AboutForm profile={profile} onSaved={reload} />

        <section className="mt-10">
          <h2 className="text-2xl">Your documents</h2>
          <p className="mt-1 text-ink-soft">
            Only you and HOMEX admins can open these. Use a PDF, JPG or PNG up to 4 MB.
            {profile.verificationStatus === 'approved' &&
              ' Changing a document sends your profile back for review.'}
          </p>
          <ul className="mt-4 space-y-4">
            {DOCUMENT_GROUPS.map((group) => (
              <DocumentGroup
                key={group.type}
                group={group}
                profile={profile}
                ownerId={user.id}
                onChanged={reload}
              />
            ))}
          </ul>
        </section>

        <SubmitSection profile={profile} onChanged={reload} />
      </>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Profile &amp; Documents</h1>
      {content()}
    </div>
  );
}
