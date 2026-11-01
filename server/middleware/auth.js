import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { readSession } from '../utils/session.js';

export async function requireAuth(req, res, next) {
  const session = readSession(req);
  const user = session && (await User.findById(session.sub));

  if (!user || !user.isActive || user.tokenVersion !== session.tv) {
    throw new ApiError(401, 'Please log in to continue');
  }

  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'You do not have access to this');
    }
    next();
  };
}
