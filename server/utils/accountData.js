import { Alert } from '../models/Alert.js';
import { Assignment } from '../models/Assignment.js';
import { Booking } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { CareReport } from '../models/CareReport.js';
import { CheckIn } from '../models/CheckIn.js';
import { Complaint } from '../models/Complaint.js';
import { ConsentLog } from '../models/ConsentLog.js';
import { Medicine } from '../models/Medicine.js';
import { Notification } from '../models/Notification.js';
import { Parent } from '../models/Parent.js';
import { Payment } from '../models/Payment.js';
import { Referral } from '../models/Referral.js';
import { Review } from '../models/Review.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { WellnessReport } from '../models/WellnessReport.js';
import { disconnectUser, emitToUsers } from '../sockets/index.js';
import { ApiError } from './ApiError.js';
import { refundVisit } from './billing.js';
import { notify } from './notifications.js';
import { SERVICE_CATALOG } from './services.js';
import { deleteFile } from './storage.js';

const OPEN_BOOKINGS = ['REQUESTED', 'ACCEPTED', 'APPOINTMENT_FIXED', 'IN_PROGRESS'];

const INTERNAL_FIELDS = new Set(['__v', 'file', 'photo', 'sosToken', 'dedupeKey', 'reference']);

// Internal fields and stored file names are left out of what people download.
const withoutInternals = (record) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !INTERNAL_FIELDS.has(key)));

const clean = (records) => records.map(withoutInternals);

async function exportCustomer(user) {
  const parents = await Parent.find({ customerId: user.id }).lean();
  const parentIds = parents.map(({ _id }) => _id);
  const forParents = { parentId: { $in: parentIds } };

  const [medicines, checkIns, alerts, careReports, wellnessReports] = await Promise.all([
    Medicine.find(forParents).lean(),
    CheckIn.find(forParents, '-photo').lean(),
    Alert.find(forParents).lean(),
    CareReport.find(forParents, '-attachments.file').lean(),
    WellnessReport.find(forParents).lean(),
  ]);
  const [subscriptions, payments, bookings, reviews, complaints] = await Promise.all([
    Subscription.find({ customerId: user.id }).lean(),
    Payment.find({ customerId: user.id }).lean(),
    Booking.find({ customerId: user.id }).lean(),
    Review.find({ customerId: user.id }).lean(),
    Complaint.find({ customerId: user.id }).lean(),
  ]);

  return {
    parents: clean(parents),
    medicines: clean(medicines),
    checkIns: clean(checkIns),
    alerts: clean(alerts),
    careReports: clean(careReports),
    wellnessReports: clean(wellnessReports),
    subscriptions: clean(subscriptions),
    payments: clean(payments),
    bookings: clean(bookings),
    reviews: clean(reviews),
    complaints: clean(complaints),
  };
}

async function exportCaregiver(user) {
  const [profile, bookings, checkIns, reviews] = await Promise.all([
    CaregiverProfile.findOne({ userId: user.id }, '-documents.file').lean(),
    Booking.find({ caregiverId: user.id }, '-customerId -notes').lean(),
    CheckIn.find({ caregiverId: user.id }, 'type time date location mood').lean(),
    Review.find({ caregiverId: user.id }, '-customerId').lean(),
  ]);

  return {
    profile: profile && withoutInternals(profile),
    bookings: clean(bookings),
    checkIns: clean(checkIns),
    reviews: clean(reviews),
  };
}

export async function buildExport(user) {
  const [consent, notifications] = await Promise.all([
    ConsentLog.find({ userId: user.id }).lean(),
    Notification.find({ userId: user.id }).lean(),
  ]);

  return {
    exportedAt: new Date(),
    account: user.toPublic(),
    consent: clean(consent),
    notifications: clean(notifications),
    ...(user.role === 'customer' && (await exportCustomer(user))),
    ...(user.role === 'caregiver' && (await exportCaregiver(user))),
  };
}

const removeFiles = (names) => Promise.all(names.filter(Boolean).map(deleteFile));

async function cancelOpenBookings(user) {
  const open = await Booking.find({ customerId: user.id, status: { $in: OPEN_BOOKINGS } });

  for (const booking of open) {
    if (booking.paymentId) await refundVisit(booking.paymentId);
    await notify(booking.caregiverId, {
      title: 'Booking cancelled',
      body: `The family cancelled the ${SERVICE_CATALOG[booking.serviceType].label.toLowerCase()}.`,
      link: '/caregiver/bookings',
    });
    emitToUsers([booking.caregiverId], 'booking:updated', { id: booking.id });
  }

  await Booking.updateMany(
    { customerId: user.id, status: { $in: OPEN_BOOKINGS } },
    { status: 'CANCELLED' },
  );
  await Booking.updateMany(
    { customerId: user.id, paymentStatus: 'paid', status: 'CANCELLED' },
    { paymentStatus: 'refunded' },
  );
}

// Health and personal records go for good. Payments stay for accounting, and finished
// bookings stay for caregiver earnings, but neither holds anything that names the family.
async function eraseCustomer(user) {
  await cancelOpenBookings(user);

  const parents = await Parent.find({ customerId: user.id }, '_id');
  const forParents = { parentId: { $in: parents.map(({ _id }) => _id) } };

  const [checkIns, careReports] = await Promise.all([
    CheckIn.find(forParents, 'photo'),
    CareReport.find(forParents, 'attachments'),
  ]);
  await removeFiles([
    ...checkIns.map(({ photo }) => photo?.file),
    ...careReports.flatMap(({ attachments }) => attachments.map(({ file }) => file)),
  ]);

  await Promise.all([
    CheckIn.deleteMany(forParents),
    CareReport.deleteMany(forParents),
    WellnessReport.deleteMany(forParents),
    Medicine.deleteMany(forParents),
    Alert.deleteMany(forParents),
    Assignment.deleteMany(forParents),
    Subscription.deleteMany({ customerId: user.id }),
    Complaint.deleteMany({ customerId: user.id }),
    Referral.deleteMany({ $or: [{ referrerId: user.id }, { refereeId: user.id }] }),
    Review.updateMany({ customerId: user.id }, { $unset: { customerId: 1, comment: 1 } }),
    Booking.updateMany(
      { customerId: user.id },
      { $set: { statusHistory: [] }, $unset: { notes: 1, appointmentDetails: 1 } },
    ),
  ]);
  await Parent.deleteMany({ customerId: user.id });
}

async function eraseCaregiver(user) {
  const isCaring = await Parent.exists({
    $or: [{ primaryCaregiverId: user.id }, { backupCaregiverId: user.id }],
  });
  if (isCaring) {
    throw new ApiError(409, 'Ask your care manager to move your families before you leave');
  }
  if (await Booking.exists({ caregiverId: user.id, status: { $in: OPEN_BOOKINGS } })) {
    throw new ApiError(409, 'Finish or decline your open bookings before you leave');
  }

  const profile = await CaregiverProfile.findOne({ userId: user.id });
  if (profile) {
    await removeFiles([profile.photo?.file, ...profile.documents.map(({ file }) => file)]);
    await profile.deleteOne();
  }

  await Promise.all([
    Assignment.updateMany({ caregiverId: user.id, status: 'pending' }, { status: 'cancelled' }),
    Review.deleteMany({ caregiverId: user.id }),
  ]);
}

export async function deleteAccount(user) {
  if (user.role === 'customer') await eraseCustomer(user);
  else if (user.role === 'caregiver') await eraseCaregiver(user);
  else throw new ApiError(403, 'Staff accounts are closed by an admin');

  await Promise.all([
    Notification.deleteMany({ userId: user.id }),
    // The record that consent was given stays as evidence, marked as withdrawn.
    ConsentLog.updateMany({ userId: user.id }, { withdrawnAt: new Date() }),
  ]);
  await User.deleteOne({ _id: user.id });
  disconnectUser(user.id);
}
