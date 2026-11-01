import jwt from 'jsonwebtoken';
import { env, isProduction } from './env.js';

export const COOKIE_NAME = 'homex_session';
const SESSION_DAYS = 7;

// The frontend and API sit on different domains in production, so the cookie
// must be sameSite "none" there; that in turn requires HTTPS (secure).
const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  path: '/',
};

export function startSession(res, user) {
  const token = jwt.sign({ sub: user.id, tv: user.tokenVersion }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

export function endSession(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

// Returns the decoded token, or null when it is missing, expired or forged.
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export const readSession = (req) => verifySessionToken(req.cookies?.[COOKIE_NAME]);
