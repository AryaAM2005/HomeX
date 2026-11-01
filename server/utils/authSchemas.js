import { z } from 'zod';

const COUNTRIES = ['IN', 'US', 'GB', 'AE', 'CA', 'AU', 'SG', 'OTHER'];

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

// bcrypt only reads the first 72 bytes, so longer passwords are refused rather than silently cut.
const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password is too long');

const phone = z
  .string()
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Enter a valid mobile number'));

function isTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long'),
    email,
    phone,
    password: newPassword,
    role: z.enum(['customer', 'caregiver'], 'Choose how you will use HOMEX'),
    country: z.enum(COUNTRIES).default('IN'),
    timezone: z.string().refine(isTimeZone, 'Unknown time zone').default('Asia/Kolkata'),
    consent: z.literal(true, 'Please give your consent to continue'),
  })
  .transform((data, ctx) => {
    if (data.country === 'IN') {
      const local = data.phone.replace(/^(\+91|0)/, '');
      if (/^[6-9]\d{9}$/.test(local)) return { ...data, phone: local };
      ctx.issues.push({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a valid 10-digit mobile number',
        input: data.phone,
      });
      return z.NEVER;
    }

    if (data.phone.startsWith('+')) return data;
    ctx.issues.push({
      code: 'custom',
      path: ['phone'],
      message: 'Include your country code, like +1 415 555 0100',
      input: data.phone,
    });
    return z.NEVER;
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'This reset link is not valid'),
  password: newPassword,
});
