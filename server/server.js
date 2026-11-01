import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { app } from './app.js';
import { startCareJobs } from './jobs/careJob.js';
import { startSubscriptionJob } from './jobs/subscriptionJob.js';
import { startWellnessJob } from './jobs/wellnessJob.js';
import { initSockets } from './sockets/index.js';
import { env } from './utils/env.js';
import { ensurePlans } from './utils/ensurePlans.js';
import { ensureStaff } from './utils/ensureStaff.js';

try {
  await mongoose.connect(env.MONGODB_URI);
  await ensureStaff();
  await ensurePlans();
} catch (err) {
  console.error(`Could not connect to MongoDB at startup: ${err.message}`);
  process.exit(1);
}

const httpServer = createServer(app);
initSockets(httpServer);

startSubscriptionJob();
startCareJobs();
startWellnessJob();

httpServer.listen(env.PORT, () => {
  console.log(`HOMEX API running on http://localhost:${env.PORT}`);
});
