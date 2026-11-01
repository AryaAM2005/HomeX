import { Bell } from 'lucide-react';
import { Link } from 'react-router';
import { useLiveEvents } from '../api/socket';
import { useApi } from '../hooks/useApi';

export default function NotificationBell() {
  const { data, reload } = useApi('/notifications');
  const unread = data?.unread ?? 0;

  useLiveEvents(['notification:new', 'notifications:read', 'connect'], reload);

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative grid size-12 place-items-center rounded-lg"
    >
      <Bell aria-hidden="true" size={26} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 grid min-w-6 place-items-center rounded-full bg-clay px-1 text-base font-bold leading-6 text-white"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
