import { useEffect } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { useLiveEvents } from '../api/socket';
import LoadError from '../components/LoadError';
import Loading from '../components/Loading';
import { useApi } from '../hooks/useApi';
import { usePageTitle } from '../hooks/usePageTitle';
import { formatDateTime } from '../utils/format';

function Row({ notification }) {
  const content = (
    <>
      <p className="font-semibold">
        {!notification.read && <span className="sr-only">Unread: </span>}
        {notification.title}
      </p>
      <p>{notification.body}</p>
      <p className="text-ink-soft">{formatDateTime(notification.createdAt)}</p>
    </>
  );

  return (
    <li className={`p-4 ${notification.read ? '' : 'border-l-4 border-clay bg-white'}`}>
      {notification.link ? (
        <Link to={notification.link} className="block hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

export default function Notifications() {
  usePageTitle('Notifications');
  const { data, loading, error, reload } = useApi('/notifications');
  useLiveEvents(['notification:new'], reload);

  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (unread > 0) api.post('/notifications/read-all').catch(() => {});
  }, [unread]);

  const content = () => {
    if (loading) return <Loading />;
    if (error) return <LoadError message={error} onRetry={reload} />;
    if (data.notifications.length === 0) {
      return <p className="mt-4 text-ink-soft">Nothing yet.</p>;
    }

    return (
      <ul className="mt-6 divide-y divide-line border-y border-line">
        {data.notifications.map((notification) => (
          <Row key={notification.id} notification={notification} />
        ))}
      </ul>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-4xl">Notifications</h1>
      {content()}
    </div>
  );
}
