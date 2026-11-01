import { z } from 'zod';

const objectId = (message) => z.string().regex(/^[0-9a-f]{24}$/i, message);
const dose = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time');
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date');

const reading = (label, min, max) =>
  z.number(`Enter a number for ${label}`).min(min, `Check the ${label}`).max(max, `Check the ${label}`);

export const checkInSchema = z
  .object({
    parentId: objectId('Choose a parent'),
    type: z.enum(['visit', 'call'], 'Choose a visit or a call'),
    location: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .optional(),
    mood: z.enum(['great', 'good', 'okay', 'low', 'unwell'], 'Choose a mood'),
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
    medicines: z
      .array(
        z.object({
          medicineId: objectId('Choose a medicine'),
          time: dose,
          status: z.enum(['given', 'missed'], 'Mark each dose given or missed'),
        }),
      )
      .max(40)
      .default([]),
    notes: z.string().trim().max(1000, 'Keep notes under 1000 characters').default(''),
  })
  .refine((data) => data.type !== 'visit' || data.location, {
    path: ['location'],
    message: 'Share your location to log a visit',
  });

export const checkInQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Enter a valid month')
    .optional(),
});

export const medicineSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter the medicine name').max(80, 'Name is too long'),
    dose: z.string().trim().min(1, 'Enter the dose').max(60, 'Dose is too long'),
    times: z
      .array(dose)
      .min(1, 'Add at least one time')
      .max(6, 'Add six times or fewer')
      .refine((times) => new Set(times).size === times.length, 'Each time can only appear once'),
    startDate: day,
    endDate: day.nullish(),
  })
  .refine(({ startDate, endDate }) => !endDate || endDate >= startDate, {
    path: ['endDate'],
    message: 'The end date must be after the start date',
  });

export const sosSchema = z.object({
  parentId: objectId('Choose a parent'),
  note: z.string().trim().max(300, 'Keep it under 300 characters').optional(),
});

export const updateAlertSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('acknowledge') }),
    z.object({
      action: z.literal('resolve'),
      note: z.string().trim().min(3, 'Add a note on what was done').max(500, 'Note is too long'),
    }),
  ],
  'Choose acknowledge or resolve',
);

export const alertQuerySchema = z.object({
  status: z.enum(['active', 'resolved']).default('active'),
});
