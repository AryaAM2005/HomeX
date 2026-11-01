import { Notification } from '../models/Notification.js';
import { emitToUsers } from './live.js';

const isDuplicate = (err) => err.code === 11000;

export function toPublicNotification(notification) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    link: notification.link ?? null,
    read: notification.read,
    createdAt: notification.createdAt,
  };
}

export async function notify(userId, { title, body, link, dedupeKey }) {
  if (!userId) return null;

  try {
    const notification = await Notification.create({ userId, title, body, link, dedupeKey });
    await emitToUsers([userId], 'notification:new', toPublicNotification(notification));
    return notification;
  } catch (err) {
    if (isDuplicate(err)) return null;
    throw err;
  }
}
