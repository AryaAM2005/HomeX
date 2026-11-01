import mongoose from 'mongoose';
import { pointSchema } from './point.js';

const { ObjectId } = mongoose.Schema.Types;

// Checkout saves a name only, so everything but the name can be filled in later.
const parentSchema = new mongoose.Schema(
  {
    customerId: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    age: { type: Number },
    address: { type: String, trim: true },
    location: { type: pointSchema, default: undefined },
    conditions: [{ type: String, trim: true }],
    allergies: [{ type: String, trim: true }],
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
    primaryCaregiverId: { type: ObjectId, ref: 'User', index: true },
    backupCaregiverId: { type: ObjectId, ref: 'User', index: true },
    careManagerId: { type: ObjectId, ref: 'User', index: true },
    // The secret in the parent's no-login SOS link.
    sosToken: { type: String, unique: true, sparse: true, select: false },
  },
  { timestamps: true },
);

export const Parent = mongoose.model('Parent', parentSchema);
