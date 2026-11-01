import mongoose from 'mongoose';

const storedFileSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  data: { type: Buffer, required: true },
});

export const StoredFile = mongoose.model('StoredFile', storedFileSchema);
