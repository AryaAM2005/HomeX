import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const apiUrl = import.meta.env.VITE_API_URL;

// One connection for the whole app. AuthProvider opens it on login and closes it on logout.
export const socket = io(apiUrl ? new URL(apiUrl).origin : undefined, {
  autoConnect: false,
  withCredentials: true,
});

// Runs the handler on every server event, always using the latest version of it.
export function useLiveEvents(events, handler) {
  const latestHandler = useRef(handler);

  useEffect(() => {
    latestHandler.current = handler;
  });

  const eventList = events.join(' ');

  useEffect(() => {
    const listener = (payload) => latestHandler.current(payload);
    const names = eventList.split(' ');

    names.forEach((name) => socket.on(name, listener));
    return () => names.forEach((name) => socket.off(name, listener));
  }, [eventList]);
}
