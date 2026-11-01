import crypto from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env.js';

const UPLOAD_DIR = env.UPLOAD_DIR ?? path.resolve(import.meta.dirname, '../uploads');

// The only code that touches stored files, so moving to Cloudinary means changing this file.
// Files stay outside any public folder because they include ID and police documents.
export async function saveFile(buffer, extension) {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}${extension}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return name;
}

export const filePath = (name) => path.join(UPLOAD_DIR, name);

export async function deleteFile(name) {
  await rm(filePath(name), { force: true });
}
