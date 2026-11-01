import mongoose from 'mongoose';
import { app } from './app.js';
import { env } from './utils/env.js';
import { ensurePlans } from './utils/ensurePlans.js';
import { ensureStaff } from './utils/ensureStaff.js';
import { startScheduler } from './utils/scheduler.js';

try {
  await mongoose.connect(env.MONGODB_URI);
  await ensureStaff();
  await ensurePlans();
} catch (err) {
  console.error(`Could not start: ${err.message}`);
  process.exit(1);
}

startScheduler();

app.listen(env.PORT, () => {
  console.log(`HOMEX API running on http://localhost:${env.PORT}`);
});
