import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { ConsentLog } from '../models/ConsentLog.js';
import { User } from '../models/User.js';
import { disconnectUser } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../utils/env.js';
import { sendMail } from '../utils/mailer.js';
import { endSession, readSession, startSession } from '../utils/session.js';

const SALT_ROUNDS = 12;
const RESET_LINK_MINUTES = 60;
const CONSENT_POLICY_VERSION = '2026-11';

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createReferralCode = () => `HX${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

export async function register(req, res) {
  const { name, email, phone, role, country, timezone, password } = req.body;
  const user = await User.create({
    name,
    email,
    phone,
    role,
    country,
    timezone,
    passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    referralCode: role === 'customer' ? createReferralCode() : undefined,
  });

  try {
    await ConsentLog.create({
      userId: user.id,
      purpose: 'account_and_care_data',
      policyVersion: CONSENT_POLICY_VERSION,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    // An account must never exist without its consent record.
    await User.deleteOne({ _id: user.id });
    throw err;
  }

  startSession(res, user);
  res.status(201).json({ user: user.toPublic() });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(401, 'Incorrect email or password');
  }
  if (!user.isActive) {
    throw new ApiError(403, 'This account has been deactivated. Please contact HOMEX support.');
  }

  startSession(res, user);
  res.json({ user: user.toPublic() });
}

export async function logout(req, res) {
  const session = readSession(req);
  if (session) {
    await User.updateOne({ _id: session.sub, tokenVersion: session.tv }, { $inc: { tokenVersion: 1 } });
    disconnectUser(session.sub);
  }

  endSession(res);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ user: req.user.toPublic() });
}

export async function forgotPassword(req, res) {
  const user = await User.findOne({ email: req.body.email, isActive: true });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = hashResetToken(token);
    user.resetTokenExpires = new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000);
    await user.save();

    // Not awaited: a slow mail server must not reveal whether this email has an account.
    sendMail({
      to: user.email,
      subject: 'Reset your HOMEX password',
      text: `Open this link within ${RESET_LINK_MINUTES} minutes to choose a new password: ${env.CLIENT_URL}/reset-password/${token}`,
    }).catch((err) => console.error('Could not send password reset email:', err));
  }

  res.json({ message: 'If that email has a HOMEX account, a reset link is on its way.' });
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  const user = await User.findOne({
    resetTokenHash: hashResetToken(token),
    resetTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(400, 'This reset link has expired or was already used. Please request a new one.');
  }

  user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  user.resetTokenHash = undefined;
  user.resetTokenExpires = undefined;
  user.tokenVersion += 1;
  await user.save();
  disconnectUser(user.id);

  endSession(res);
  res.json({ message: 'Your password has been changed. You can log in now.' });
}
