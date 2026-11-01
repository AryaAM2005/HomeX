import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { Link } from 'react-router';
import { useLiveEvents } from '../api/socket';
import { useAuth } from '../context/useAuth';

const ALERTS_PAGE = {
  customer: '/alerts',
  careManager: '/care-manager/alerts',
  admin: '/admin/alerts',
};

export default function LiveAlertBanner() {
  const { user } = useAuth();
  const [alert, setAlert] = useState(null);

  useLiveEvents(['alert:new'], setAlert);

  if (!user || !alert) return null;

  return (
    <div role="alert" className="bg-sos text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <BellRing aria-hidden="true" size={26} className="shrink-0" />
        <p className="min-w-0 flex-1">
          <strong>
            {alert.title}: {alert.parent.name}.
          </strong>{' '}
          {alert.message}.{' '}
          <Link
            to={ALERTS_PAGE[user.role]}
            onClick={() => setAlert(null)}
            className="font-semibold whitespace-nowrap underline underline-offset-4"
          >
            View alerts
          </Link>
        </p>
        <button
          type="button"
          onClick={() => setAlert(null)}
          aria-label="Dismiss alert"
          className="grid size-11 shrink-0 place-items-center rounded-lg"
        >
          <X aria-hidden="true" size={24} />
        </button>
      </div>
    </div>
  );
}
