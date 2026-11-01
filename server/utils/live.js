import { LiveEvent } from '../models/LiveEvent.js';
import { User } from '../models/User.js';

// Open pages collect these through GET /api/live, so a user can only ever receive
// what the server addresses to them. A lost update must never fail the action behind it.
export async function emitToUsers(userIds, event, payload) {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];

  try {
    await LiveEvent.insertMany(unique.map((userId) => ({ userId, event, payload })));
  } catch (err) {
    console.error(`Could not record the ${event} live event:`, err);
  }
}

export async function emitToAdmins(event, payload) {
  const admins = await User.find({ role: 'admin', isActive: true }, '_id');
  await emitToUsers(admins.map(({ id }) => id), event, payload);
}
