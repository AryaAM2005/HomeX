import { Notification } from '../models/Notification.js';
import { emitToUsers } from '../sockets/index.js';
import { toPublicNotification } from '../utils/notifications.js';

export async function listNotifications(req, res) {
  const [notifications, unread] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ userId: req.user.id, read: false }),
  ]);

  res.json({ notifications: notifications.map(toPublicNotification), unread });
}

export async function markAllRead(req, res) {
  await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
  emitToUsers([req.user.id], 'notifications:read', {});
  res.status(204).end();
}
