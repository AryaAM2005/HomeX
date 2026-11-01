import { useAuth } from '../context/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';

const ROLE_LABELS = {
  customer: 'Customer',
  caregiver: 'Caregiver',
  careManager: 'Care Manager',
  admin: 'Admin',
};

export default function DashboardShell({ title, intro, notice, children, upcoming = [] }) {
  const { user } = useAuth();
  usePageTitle(title);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <p className="font-semibold text-clay">{title}</p>
      <h1 className="mt-1 text-4xl">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">{intro}</p>

      {notice}
      {children}

      <dl className="mt-8 grid gap-4 rounded-2xl border border-line bg-white p-6 sm:grid-cols-2">
        <div>
          <dt className="text-base text-ink-soft">Name</dt>
          <dd className="font-semibold">{user.name}</dd>
        </div>
        <div>
          <dt className="text-base text-ink-soft">Email</dt>
          <dd className="font-semibold break-words">{user.email}</dd>
        </div>
        <div>
          <dt className="text-base text-ink-soft">Mobile</dt>
          <dd className="font-semibold">{user.phone}</dd>
        </div>
        <div>
          <dt className="text-base text-ink-soft">Account type</dt>
          <dd className="font-semibold">{ROLE_LABELS[user.role]}</dd>
        </div>
      </dl>

      {upcoming.length > 0 && (
        <>
          <h2 className="mt-10 text-2xl">Coming to this dashboard</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-ink-soft">
            {upcoming.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
