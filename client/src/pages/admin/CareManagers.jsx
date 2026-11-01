import { useState } from 'react';
import { api, getErrorMessage } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import FormField from '../../components/FormField';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { useForm } from '../../hooks/useForm';
import { usePageTitle } from '../../hooks/usePageTitle';
import { compact, emailError, newPasswordError } from '../../utils/validators';

const EMPTY_FORM = { name: '', email: '', phone: '', password: '' };

function CreateForm({ onCreated }) {
  const { field, setValue, formError, submitting, handleSubmit } = useForm({
    initial: EMPTY_FORM,
    validate: ({ name, email, phone, password }) =>
      compact({
        name: name.trim().length < 2 ? 'Enter their full name' : undefined,
        email: emailError(email),
        phone: /^\+?\d{7,15}$/.test(phone.replace(/[\s()-]/g, ''))
          ? undefined
          : 'Enter a valid phone number',
        password: newPasswordError(password),
      }),
    onSubmit: async (form) => {
      await api.post('/admin/care-managers', form);
      Object.entries(EMPTY_FORM).forEach(([name, value]) => setValue(name, value));
      onCreated();
    },
  });

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 space-y-4 rounded-2xl border border-line bg-white p-5 sm:p-6"
    >
      <h2 className="text-2xl">Add a care manager</h2>
      <FormAlert>{formError}</FormAlert>
      <FormField label="Full name" autoComplete="off" {...field('name')} />
      <FormField label="Email" type="email" autoComplete="off" {...field('email')} />
      <FormField label="Phone number" type="tel" autoComplete="off" {...field('phone')} />
      <FormField
        label="First password"
        type="password"
        autoComplete="new-password"
        hint="Give this to them privately. They can change it with Forgot password."
        {...field('password')}
      />
      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'Adding…' : 'Add care manager'}
      </button>
    </form>
  );
}

function ManagerRow({ manager, onChanged, onError }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    onError('');
    try {
      await api.patch(`/admin/users/${manager.id}`, { isActive: !manager.isActive });
      onChanged();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0">
        <p className="font-semibold">
          {manager.name}
          {!manager.isActive && <span className="font-normal text-danger"> (deactivated)</span>}
        </p>
        <p className="break-all text-ink-soft">{manager.email}</p>
        <p className="text-ink-soft">
          {manager.phone}, {manager.families} {manager.families === 1 ? 'family' : 'families'}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={toggle} className="btn btn-secondary">
        {manager.isActive ? 'Deactivate' : 'Reactivate'}
      </button>
    </li>
  );
}

export default function AdminCareManagers() {
  usePageTitle('Care Managers');
  const { data, loading, error, reload } = useApi('/admin/care-managers');
  const [rowError, setRowError] = useState('');

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.careManagers.length === 0) return <p className="mt-3 text-ink-soft">Nobody yet.</p>;

    return (
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {data.careManagers.map((manager) => (
          <ManagerRow key={manager.id} manager={manager} onChanged={reload} onError={setRowError} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Care Managers</h1>
      <p className="mt-2 text-ink-soft">
        New families go to whoever has the fewest. Deactivating a care manager moves their families
        to the others.
      </p>

      <h2 className="mt-8 text-3xl">Team</h2>
      <div className="mt-3">
        <FormAlert>{rowError}</FormAlert>
      </div>
      {list()}
      <CreateForm onCreated={reload} />
    </div>
  );
}
