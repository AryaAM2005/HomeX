import rateLimit from 'express-rate-limit';
import { env } from '../utils/env.js';

const limiter = (options) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } },
    ...options,
  });

export const loginLimiter = limiter({ limit: 10, skipSuccessfulRequests: true });
export const accountLimiter = limiter({ limit: 20 });

// Only wrong links count, so a real emergency is never rate limited.
export const sosLinkLimiter = limiter({ limit: 30, skipSuccessfulRequests: true });
