import { useState } from 'react';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router';
import { api, apiUrl, getErrorMessage, getFieldErrors } from '../api/client';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useAuth } from '../context/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';

const WHAT_IS_DELETED = {
  customer: [
    'Your account, your parents and their health records',
    'Check-ins, photos, medicines, alerts and reports',
    'Your plans, which end straight away with no further charges',
    'Open bookings, which are cancelled and refunded',
  ],
  caregiver: ['Your account and profile', 'Your ID, police and training documents', 'Your reviews'],
};

const WHAT_IS_KEPT = {
  customer:
    'We keep payment records for accounting, and a record that you once gave consent. Finished bookings stay for caregiver earnings, with nothing that names you.',
  caregiver:
    "Check-ins you logged stay in each parent's health record. We keep a record that you once gave consent.",
};

function DeleteAccount({ user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn bg-danger mt-3 text-white">
        Delete my account
      </button>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setFieldError('');
    try {
      await api.delete('/me/data', { data: { password } });
      await logout().catch(() => {});
      navigate('/login', { replace: true, state: { notice: 'Your account has been deleted.' } });
    } catch (err) {
      const fields = getFieldErrors(err);
      if (fields.password) setFieldError(fields.password);
      else setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="mt-3 space-y-4 rounded-2xl border-2 border-danger bg-white p-5">
      <div>
        <p className="font-semibold">This deletes for good, and cannot be undone:</p>
        <ul className="mt-1 list-disc pl-6">
          {WHAT_IS_DELETED[user.role].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-ink-soft">{WHAT_IS_KEPT[user.role]}</p>
      </div>

      <FormAlert>{error}</FormAlert>
      <FormField
        label="Your password"
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        error={fieldError}
        onChange={(event) => setPassword(event.target.value)}
      />
      <FormField
        label="Type DELETE to confirm"
        name="confirmation"
        autoComplete="off"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || confirmation !== 'DELETE' || !password}
          className="btn bg-danger text-white disabled:opacity-60"
        >
          {busy ? 'Deleting…' : 'Delete everything'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
          Keep my account
        </button>
      </div>
    </form>
  );
}

export default function Settings() {
  usePageTitle('Settings');
  const { user } = useAuth();
  const canDelete = user.role === 'customer' || user.role === 'caregiver';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Settings</h1>

      <dl className="mt-6 space-y-3 rounded-2xl border border-line bg-white p-5">
        <div>
          <dt className="text-base text-ink-soft">Name</dt>
          <dd className="font-semibold">{user.name}</dd>
        </div>
        <div>
          <dt className="text-base text-ink-soft">Email</dt>
          <dd className="font-semibold break-all">{user.email}</dd>
        </div>
        <div>
          <dt className="text-base text-ink-soft">Mobile</dt>
          <dd className="font-semibold">{user.phone}</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-2xl">Your data</h2>
        <p className="mt-1 text-ink-soft">
          Download a copy of everything HOMEX holds about you, as a JSON file.
        </p>
        <a href={apiUrl('/me/data')} download className="btn btn-secondary mt-3">
          <Download aria-hidden="true" size={20} />
          Download my data
        </a>
      </section>

      {canDelete && (
        <section className="mt-8">
          <h2 className="text-2xl">Delete your account</h2>
          <p className="mt-1 text-ink-soft">
            This withdraws your consent and removes your data. Deletion happens straight away.
          </p>
          <DeleteAccount user={user} />
        </section>
      )}
    </div>
  );
}
