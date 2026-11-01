import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const optionalText = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'is required'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  CLIENT_URL: z.url().default('http://localhost:5173'),
  ADMIN_EMAIL: optionalText,
  ADMIN_PASSWORD: optionalText,
  CARE_MANAGER_EMAIL: optionalText,
  CARE_MANAGER_PASSWORD: optionalText,
  SEED_PASSWORD: optionalText,
  SEED_ON_START: optionalText,
  UPLOAD_DIR: optionalText,
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  MAIL_FROM: z.string().default('HOMEX <no-reply@homex.local>'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  ${issue.path.join('.')} ${issue.message}`);
  console.error(`Invalid server configuration. Check server/.env:\n${problems.join('\n')}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
