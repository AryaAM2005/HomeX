import crypto from 'node:crypto';
import { StoredFile } from '../models/StoredFile.js';
import { ApiError } from './ApiError.js';

// The only code that touches stored files, so moving to Cloudinary means changing this file.
// Vercel's disk doesn't last, so files live in MongoDB. They stay behind logged-in routes
// because they include ID and police documents.
export async function saveFile(buffer, extension) {
  const name = `${crypto.randomUUID()}${extension}`;
  await StoredFile.create({ _id: name, data: buffer });
  return name;
}

export async function sendFile(res, name) {
  const stored = await StoredFile.findById(name);
  if (!stored) throw new ApiError(404, 'We could not find that file');
  res.send(stored.data);
}

export async function deleteFile(name) {
  await StoredFile.deleteOne({ _id: name });
}
