import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { env } from './env.js';

const staff = [
  {
    name: 'Admin',
    role: 'admin',
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    phone: '9000000000',
  },
  {
    name: 'Manager',
    role: 'careManager',
    email: env.CARE_MANAGER_EMAIL,
    password: env.CARE_MANAGER_PASSWORD,
    phone: '9000000001',
  },
];

// Staff cannot sign up through the website, so the first accounts come from server/.env.
export async function ensureStaff() {
  for (const { password, ...account } of staff) {
    if (!account.email || !password) continue;

    const email = account.email.toLowerCase();
    if (await User.exists({ email })) continue;

    await User.create({
      ...account,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      isVerified: true,
    });
    console.log(`Created ${account.role} account ${email}`);
  }
}
