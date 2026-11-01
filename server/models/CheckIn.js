import mongoose from 'mongoose';
import { pointSchema } from './point.js';

const { ObjectId } = mongoose.Schema.Types;

const checkInSchema = new mongoose.Schema(
  {
    parentId: { type: ObjectId, ref: 'Parent', required: true },
    caregiverId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['visit', 'call'], required: true },
    time: { type: Date, required: true },
    // The care day in India time, which keeps calendar lookups simple.
    date: { type: String, required: true },
    location: { type: pointSchema, default: undefined },
    distanceFromHomeM: { type: Number },
    photo: { file: String, mime: String },
    mood: { type: String, enum: ['great', 'good', 'okay', 'low', 'unwell'], required: true },
    vitals: {
      bpSystolic: Number,
      bpDiastolic: Number,
      sugar: Number,
      temperature: Number,
      pulse: Number,
    },
    medicinesGiven: [
      {
        _id: false,
        medicineId: { type: ObjectId, ref: 'Medicine', required: true },
        name: { type: String, required: true },
        time: { type: String, required: true },
        status: { type: String, enum: ['given', 'missed'], required: true },
      },
    ],
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

checkInSchema.index({ parentId: 1, date: -1 });
checkInSchema.index({ caregiverId: 1, date: -1 });

export const CheckIn = mongoose.model('CheckIn', checkInSchema);
