import mongoose from 'mongoose';
import { pointSchema } from './point.js';

export const SERVICES = [
  'daily_checkin',
  'doctor_visit',
  'lab_test',
  'meals_medicines',
  'companionship',
  'post_hospital',
];
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DOCUMENT_TYPES = ['id', 'police', 'certificate'];

const documentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: DOCUMENT_TYPES, required: true },
    name: { type: String, required: true },
    file: { type: String, required: true },
    mime: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const caregiverProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    bio: { type: String, trim: true },
    services: [{ type: String, enum: SERVICES }],
    experienceYears: { type: Number, default: 0 },
    languages: [{ type: String, trim: true }],
    area: { type: String, trim: true },
    location: { type: pointSchema, default: undefined },
    serviceRadiusKm: { type: Number, default: 10 },
    availability: [
      {
        _id: false,
        day: { type: String, enum: WEEKDAYS, required: true },
        start: { type: String, required: true },
        end: { type: String, required: true },
      },
    ],
    documents: [documentSchema],
    certificates: [{ type: String, trim: true }],
    photo: { file: String, mime: String },
    policeVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'draft',
    },
    rejectionReason: { type: String, trim: true },
    submittedAt: { type: Date },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

caregiverProfileSchema.index({ location: '2dsphere' });
caregiverProfileSchema.index({ verificationStatus: 1 });

export const CaregiverProfile = mongoose.model('CaregiverProfile', caregiverProfileSchema);
