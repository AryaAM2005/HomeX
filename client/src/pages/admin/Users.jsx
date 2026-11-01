import { useState } from 'react';
import { api, getErrorMessage } from '../../api/client';
import FormAlert from '../../components/FormAlert';
import LoadError from '../../components/LoadError';
import Loading from '../../components/Loading';
import { useApi } from '../../hooks/useApi';
import { usePageTitle } from '../../hooks/usePageTitle';

const ROLE_LABELS = {
  customer: 'Customer',
  caregiver: 'Caregiver',
  careManager: 'Care manager',
  admin: 'Admin',
};

function UserRow({ user, onChanged, onError }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    onError('');
    try {
      await api.patch(`/admin/users/${user.id}`, { isActive: !user.isActive });
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
          {user.name}
          {!user.isActive && <span className="font-normal text-danger"> (deactivated)</span>}
        </p>
        <p className="break-all text-ink-soft">{user.email}</p>
        <p className="text-ink-soft">
          {ROLE_LABELS[user.role]}, {user.phone}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={toggle} className="btn btn-secondary">
        {user.isActive ? 'Deactivate' : 'Reactivate'}
      </button>
    </li>
  );
}

export default function AdminUsers() {
  usePageTitle('Users');
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [rowError, setRowError] = useState('');

  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (query) params.set('q', query);
  const { data, loading, error, reload } = useApi(`/admin/users?${params}`);

  const list = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.users.length === 0) return <p className="mt-4 text-ink-soft">Nobody found.</p>;

    return (
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {data.users.map((user) => (
          <UserRow key={user.id} user={user} onChanged={reload} onError={setRowError} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Users</h1>
      <p className="mt-2 text-ink-soft">
        Deactivating someone ends their session straight away. Their records are kept.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}
        className="mt-6 grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      >
        <div>
          <label htmlFor="search" className="block font-semibold">
            Name or email
          </label>
          <input
            id="search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 py-2"
          />
        </div>
        <div>
          <label htmlFor="role" className="block font-semibold">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-3 py-2"
          >
            <option value="">Everyone</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>

      <div className="mt-4">
        <FormAlert>{rowError}</FormAlert>
      </div>
      {list()}
    </div>
  );
}
