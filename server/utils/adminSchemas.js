import { z } from 'zod';
import { BOOKING_STATUSES } from '../models/Booking.js';

export const userQuerySchema = z.object({
  role: z.enum(['customer', 'caregiver', 'careManager', 'admin']).optional(),
  q: z.string().trim().max(80).optional(),
});

export const updateUserSchema = z.object({
  isActive: z.boolean('Choose active or inactive'),
});

export const createCareManagerSchema = z.object({
  name: z.string().trim().min(2, 'Enter their full name').max(80, 'Name is too long'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Enter a valid phone number')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => Buffer.byteLength(value) <= 72, 'Password is too long'),
});

export const adminBookingQuerySchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
});

export const complaintQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).default('open'),
});

export const createComplaintSchema = z.object({
  bookingId: z.string().regex(/^[0-9a-f]{24}$/i, 'Choose a booking'),
  message: z.string().trim().min(10, 'Tell us what went wrong').max(1000, 'Keep it under 1000 characters'),
});

export const resolveComplaintSchema = z.object({
  resolution: z.string().trim().min(5, 'Say how this was resolved').max(1000, 'Keep it under 1000 characters'),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
});
