import mongoose from 'mongoose';
import { app } from '../server/app.js';
import { env } from '../server/utils/env.js';
import { ensurePlans } from '../server/utils/ensurePlans.js';
import { ensureStaff } from '../server/utils/ensureStaff.js';

let ready = null;

// Vercel reuses a running copy of this file between requests, so one connection serves them all.
function prepare() {
  ready ??= (async () => {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000, maxPoolSize: 5 });
    await ensureStaff();
    await ensurePlans();
  })().catch((err) => {
    ready = null;
    throw err;
  });

  return ready;
}

export default async function handler(req, res) {
  try {
    await prepare();
  } catch (err) {
    console.error(`Could not start: ${err.message}`);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { message: 'HOMEX is starting up. Please try again shortly.' } }));
    return;
  }

  app(req, res);
}
