import { z } from 'zod';

const objectId = (message) => z.string().regex(/^[0-9a-f]{24}$/i, message);

const planId = objectId('Choose a plan');
const billingCycle = z.enum(['monthly', 'annual'], 'Choose monthly or annual billing');
const currency = z.enum(['INR', 'USD'], 'Choose INR or USD');
const code = z
  .string()
  .trim()
  .toUpperCase()
  .max(24, 'This code is not valid')
  .optional()
  .transform((value) => value || undefined);

export const quoteSchema = z.object({ planId, billingCycle, currency, code });

export const subscribeSchema = quoteSchema.extend({
  parentId: objectId('Choose which parent this plan is for'),
});

export const updateSubscriptionSchema = z.discriminatedUnion(
  'action',
  [
    z.object({ action: z.literal('change_plan'), planId, billingCycle }),
    z.object({ action: z.literal('cancel') }),
    z.object({ action: z.literal('pay_now') }),
  ],
  'Choose what to change',
);

const features = z
  .array(z.string().trim().min(1).max(120))
  .min(1, 'Add at least one feature')
  .max(12, 'Keep it to 12 features or fewer');

export const updatePlanSchema = z
  .object({
    summary: z.string().trim().min(1, 'Add a short summary').max(160, 'Summary is too long'),
    features,
    priceInr: z.number('Enter a price').int('Use whole rupees').positive('Enter a price above 0'),
    usdPrice: z.number('Enter a price').positive('Enter a price above 0'),
    checkinsPerWeek: z.number('Enter a number').int().min(0).max(14),
    visitsPerWeek: z.number('Enter a number').int().min(0).max(14),
    recommended: z.boolean(),
    active: z.boolean(),
  })
  .partial();

export const createEmployerCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4,20}$/, 'Use 4 to 20 letters and numbers')
    .refine((value) => !value.startsWith('HX'), 'HX is reserved for referral codes'),
  company: z.string().trim().min(2, 'Enter the company name').max(80, 'Name is too long'),
  employeeCount: z
    .number('Enter the number of employees')
    .int('Enter a whole number')
    .min(10, 'Employer codes need at least 10 employees'),
});

export const updateEmployerCodeSchema = z.object({ active: z.boolean() });
