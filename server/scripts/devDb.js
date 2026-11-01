// Runs a local MongoDB for `npm run dev`, so no separate install is needed.
// Skips itself when MONGODB_URI points at Atlas or a MongoDB is already listening.
import net from 'node:net';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from '../utils/env.js';

const local = env.MONGODB_URI.match(/^mongodb:\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?\//);

if (!local) {
  console.log('MONGODB_URI is not local, so the development database was not started.');
  process.exit(0);
}

const port = Number(local[1] ?? 27017);

const alreadyRunning = await new Promise((resolve) => {
  const socket = net.connect(port, '127.0.0.1');
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
});

if (alreadyRunning) {
  console.log(`MongoDB is already running on port ${port}.`);
  process.exit(0);
}

const dbPath = path.resolve(import.meta.dirname, '../.mongo-data');
await mkdir(dbPath, { recursive: true });

await MongoMemoryServer.create({
  instance: { port, portGeneration: false, dbPath, storageEngine: 'wiredTiger' },
});

console.log(`Development MongoDB ready on port ${port}. Data is kept in server/.mongo-data`);
