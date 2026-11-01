import { z } from 'zod';
import { SERVICE_TYPES } from './services.js';

const objectId = (message) => z.string().regex(/^[0-9a-f]{24}$/i, message);
const serviceType = z.enum(SERVICE_TYPES, 'Choose a service');
const currency = z.enum(['INR', 'USD'], 'Choose INR or USD');

const reading = (label, min, max) =>
  z.number(`Enter a number for ${label}`).min(min, `Check the ${label}`).max(max, `Check the ${label}`);

export const bookingQuoteSchema = z.object({
  parentId: objectId('Choose a parent'),
  serviceType,
  currency,
});

export const createBookingSchema = bookingQuoteSchema.extend({
  caregiverId: objectId('Choose a caregiver'),
  scheduledAt: z.iso.datetime({ offset: true, error: 'Choose a date and time' }),
  notes: z.string().trim().max(500, 'Keep notes under 500 characters').default(''),
});

const note = z.string().trim().max(300, 'Keep it under 300 characters').optional();

export const bookingActionSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('accept') }),
    z.object({ action: z.literal('reject'), note }),
    z.object({
      action: z.literal('fix_appointment'),
      note: z.string().trim().min(5, 'Add the doctor or lab, and the time').max(300),
    }),
    z.object({ action: z.literal('start') }),
    z.object({ action: z.literal('complete') }),
    z.object({ action: z.literal('cancel'), note }),
  ],
  'Choose what to do with this booking',
);

export const careReportSchema = z.object({
  doctorName: z.string().trim().min(2, 'Enter the doctor or lab name').max(120, 'Name is too long'),
  hospital: z.string().trim().max(120, 'Name is too long').default(''),
  diagnosisSummary: z
    .string()
    .trim()
    .min(10, 'Write what the doctor or lab said')
    .max(2000, 'Keep it under 2000 characters'),
  vitals: z
    .object({
      bpSystolic: reading('blood pressure', 50, 260),
      bpDiastolic: reading('blood pressure', 30, 160),
      sugar: reading('blood sugar', 20, 700),
      temperature: reading('temperature', 90, 110),
      pulse: reading('pulse', 20, 220),
    })
    .partial()
    .default({}),
  prescriptions: z.string().trim().max(1000, 'Keep it under 1000 characters').default(''),
  nextFollowUp: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
    .optional(),
  notes: z.string().trim().max(1000, 'Keep notes under 1000 characters').default(''),
});

export const reviewSchema = z.object({
  caregiverId: objectId('Choose a caregiver'),
  bookingId: objectId('Choose a booking').optional(),
  rating: z.number('Choose a rating').int('Choose a rating').min(1, 'Choose a rating').max(5),
  comment: z.string().trim().max(500, 'Keep it under 500 characters').default(''),
});
