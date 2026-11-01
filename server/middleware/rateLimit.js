import rateLimit from 'express-rate-limit';
import { RateLimit } from '../models/RateLimit.js';
import { env } from '../utils/env.js';

// Serverless copies of the app share no memory, so the counts live in the database.
export class MongoRateLimitStore {
  localKeys = false;

  constructor(prefix) {
    this.prefix = prefix;
  }

  init({ windowMs }) {
    this.windowMs = windowMs;
  }

  async count(key, retry = true) {
    const now = new Date();
    const running = { $gt: ['$resetAt', now] };

    try {
      return await RateLimit.findOneAndUpdate(
        { _id: `${this.prefix}:${key}` },
        [
          {
            $set: {
              hits: { $cond: [running, { $add: ['$hits', 1] }, 1] },
              resetAt: { $cond: [running, '$resetAt', new Date(now.getTime() + this.windowMs)] },
            },
          },
        ],
        { upsert: true, returnDocument: 'after', updatePipeline: true },
      );
    } catch (err) {
      // Two first requests can race to create the row. The loser just counts again.
      if (err.code === 11000 && retry) return this.count(key, false);
      throw err;
    }
  }

  async increment(key) {
    const { hits, resetAt } = await this.count(key);
    return { totalHits: hits, resetTime: resetAt };
  }

  async decrement(key) {
    await RateLimit.updateOne({ _id: `${this.prefix}:${key}` }, { $inc: { hits: -1 } });
  }

  async resetKey(key) {
    await RateLimit.deleteOne({ _id: `${this.prefix}:${key}` });
  }
}

const limiter = (name, options) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    store: new MongoRateLimitStore(name),
    // A database hiccup must not lock anyone out, least of all from an SOS link.
    passOnStoreError: true,
    message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } },
    ...options,
  });

export const loginLimiter = limiter('login', { limit: 10, skipSuccessfulRequests: true });
export const accountLimiter = limiter('account', { limit: 20 });

// Only wrong links count, so a real emergency is never rate limited.
export const sosLinkLimiter = limiter('sos', { limit: 30, skipSuccessfulRequests: true });
