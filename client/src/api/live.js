import { useEffect, useRef } from 'react';
import { api } from './client';

const POLL_MS = 4000;

const listeners = new Map();
let session = null;

function fire(event, payload) {
  listeners.get(event)?.forEach((listener) => listener(payload));
}

async function poll(current) {
  try {
    const { data } = await api.get('/live', { params: { after: current.cursor } });
    if (current !== session) return;

    const fresh = data.events.filter(({ id }) => !current.seen.has(id));
    current.cursor = data.now;
    current.seen = new Set(data.events.map(({ id }) => id));
    fresh.forEach(({ event, payload }) => fire(event, payload));

    if (current.offline) fire('connect');
    current.offline = false;
  } catch {
    current.offline = true;
  }

  if (current === session && !document.hidden) {
    clearTimeout(current.timer);
    current.timer = setTimeout(() => poll(current), POLL_MS);
  }
}

function handleVisibility() {
  clearTimeout(session.timer);
  if (document.hidden) return;

  // Anything older than the server keeps would be missed, so pages reload as well.
  fire('connect');
  poll(session);
}

// One poller for the whole app. AuthProvider starts it on login and stops it on logout.
export function startLiveUpdates() {
  session = { cursor: undefined, seen: new Set(), offline: false, timer: null };
  document.addEventListener('visibilitychange', handleVisibility);
  if (!document.hidden) poll(session);
}

export function stopLiveUpdates() {
  clearTimeout(session?.timer);
  session = null;
  document.removeEventListener('visibilitychange', handleVisibility);
}

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

    names.forEach((name) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    });
    return () => names.forEach((name) => listeners.get(name).delete(listener));
  }, [eventList]);
}
