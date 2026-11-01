// Loads the demo data into whatever MONGODB_URI points at. The database must be running.
import mongoose from 'mongoose';
import { seedDemoData } from './utils/demoSeed.js';
import { env } from './utils/env.js';

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

try {
  console.log(await seedDemoData());
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}

await mongoose.disconnect();
