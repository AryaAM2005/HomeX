import { z } from 'zod';
import { DOCUMENT_TYPES, SERVICES, WEEKDAYS } from '../models/CaregiverProfile.js';

const objectId = (message) => z.string().regex(/^[0-9a-f]{24}$/i, message);

const location = z.object(
  {
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  },
  'Choose a place on the map',
);

const shortList = (label) =>
  z.array(z.string().trim().min(1).max(80)).max(20, `Keep ${label} to 20 items or fewer`);

const parentFields = {
  name: z.string().trim().min(2, "Enter your parent's name").max(80, 'Name is too long'),
  age: z
    .number('Enter an age')
    .int('Enter a whole number')
    .min(40, 'Enter an age of 40 or above')
    .max(120, 'Enter a valid age'),
  address: z.string().trim().min(5, 'Enter the full address').max(300, 'Address is too long'),
  location,
  conditions: shortList('health conditions').default([]),
  allergies: shortList('allergies').default([]),
  emergencyContact: z.object({
    name: z.string().trim().min(2, 'Enter a contact name').max(80, 'Name is too long'),
    phone: z
      .string()
      .transform((value) => value.replace(/[\s()-]/g, ''))
      .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Enter a valid phone number')),
    relation: z.string().trim().max(40, 'Relation is too long').default(''),
  }),
};

export const parentProfileSchema = z.object(parentFields);

// Checkout saves a name only. The My Parents form sends everything.
export const createParentSchema = z.object(parentFields).partial().required({ name: true });

export const assignCaregiverSchema = z.object({
  caregiverId: objectId('Choose a caregiver'),
  type: z.enum(['primary', 'backup']).default('primary'),
});

export const respondToRequestSchema = z.object({
  action: z.enum(['accept', 'decline'], 'Choose accept or decline'),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time');

export const caregiverProfileSchema = z
  .object({
    bio: z.string().trim().min(20, 'Write at least 20 characters').max(600, 'Keep it under 600 characters'),
    services: z.array(z.enum(SERVICES)).min(1, 'Choose at least one service'),
    experienceYears: z.number('Enter your years of experience').int().min(0).max(60),
    languages: z.array(z.string().trim().min(1).max(30)).min(1, 'Choose at least one language').max(10),
    certificates: shortList('certificates'),
    area: z.string().trim().min(2, 'Enter your area').max(120, 'Area is too long'),
    location,
    serviceRadiusKm: z.number('Enter a distance').min(1).max(50),
    availability: z
      .array(
        z
          .object({ day: z.enum(WEEKDAYS), start: time, end: time })
          .refine(({ start, end }) => start < end, 'The end time must be after the start time'),
      )
      .refine(
        (slots) => new Set(slots.map(({ day }) => day)).size === slots.length,
        'Each day can only appear once',
      ),
  })
  .partial();

export const documentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES, 'Choose a document type'),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(100).default(10),
  service: z.enum(SERVICES).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  day: z.enum(WEEKDAYS).optional(),
  language: z.string().trim().max(30).optional(),
});

export const adminCaregiverQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
});

export const verifyCaregiverSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('approve') }),
    z.object({
      action: z.literal('reject'),
      reason: z.string().trim().min(5, 'Give a reason the caregiver can act on').max(300),
    }),
  ],
  'Choose approve or reject',
);
