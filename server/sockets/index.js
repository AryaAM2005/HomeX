import { parse } from 'cookie';
import { Server } from 'socket.io';
import { User } from '../models/User.js';
import { env } from '../utils/env.js';
import { COOKIE_NAME, verifySessionToken } from '../utils/session.js';

let io = null;

const userRoom = (userId) => `user:${userId}`;
const ADMIN_ROOM = 'admins';

async function authenticate(socket, next) {
  const cookies = parse(socket.handshake.headers.cookie ?? '');
  const session = verifySessionToken(cookies[COOKIE_NAME]);
  const user = session && (await User.findById(session.sub));

  if (!user || !user.isActive || user.tokenVersion !== session.tv) {
    return next(new Error('Please log in to continue'));
  }

  socket.data.user = user;
  next();
}

// Clients only listen. They choose no rooms and send no events, so a user can
// only ever receive what the server addresses to them.
export function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  io.use((socket, next) => {
    authenticate(socket, next).catch(next);
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(userRoom(user.id));
    if (user.role === 'admin') socket.join(ADMIN_ROOM);
  });

  return io;
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  userIds.forEach((userId) => io.to(userRoom(String(userId))).emit(event, payload));
}

export function emitToAdmins(event, payload) {
  io?.to(ADMIN_ROOM).emit(event, payload);
}

export function disconnectUser(userId) {
  io?.in(userRoom(String(userId))).disconnectSockets(true);
}
