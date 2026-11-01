import bcrypt from 'bcrypt';
import { Alert } from '../models/Alert.js';
import { Booking, BOOKING_STATUSES } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { Complaint } from '../models/Complaint.js';
import { discountForEmployees, EmployerCode } from '../models/EmployerCode.js';
import { Parent } from '../models/Parent.js';
import { Plan } from '../models/Plan.js';
import { fromPoint } from '../models/point.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { disconnectUser } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { redistributeFamilies } from '../utils/careManagers.js';
import { notify } from '../utils/notifications.js';
import { SERVICE_CATALOG } from '../utils/services.js';

export async function getStats(req, res) {
  const [
    families,
    parents,
    activePlans,
    trials,
    caregivers,
    pendingCaregivers,
    careManagers,
    openAlerts,
    escalatedAlerts,
    openComplaints,
    bookingCounts,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer', isActive: true }),
    Parent.countDocuments(),
    Subscription.countDocuments({ status: 'active' }),
    Subscription.countDocuments({ status: 'trial' }),
    CaregiverProfile.countDocuments({ verificationStatus: 'approved' }),
    CaregiverProfile.countDocuments({ verificationStatus: 'pending' }),
    User.countDocuments({ role: 'careManager', isActive: true }),
    Alert.countDocuments({ status: { $in: ['open', 'acknowledged'] } }),
    Alert.countDocuments({
      status: { $in: ['open', 'acknowledged'] },
      escalatedAt: { $exists: true },
    }),
    Complaint.countDocuments({ status: 'open' }),
    Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  const counts = new Map(bookingCounts.map(({ _id, count }) => [_id, count]));

  res.json({
    stats: {
      families,
      parents,
      activePlans,
      trials,
      caregivers,
      pendingCaregivers,
      careManagers,
      openAlerts,
      escalatedAlerts,
      openComplaints,
      bookings: BOOKING_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 })),
    },
  });
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toAdminUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export async function listUsers(req, res) {
  const { role, q } = req.validQuery;
  const search = q && new RegExp(escapeRegex(q), 'i');

  const users = await User.find({
    ...(role && { role }),
    ...(search && { $or: [{ name: search }, { email: search }] }),
  })
    .sort({ createdAt: -1 })
    .limit(100);

  res.json({ users: users.map(toAdminUser) });
}

async function warnCareManagers(caregiver) {
  const parents = await Parent.find({
    $or: [{ primaryCaregiverId: caregiver.id }, { backupCaregiverId: caregiver.id }],
  });

  await Promise.all(
    parents.map((parent) =>
      notify(parent.careManagerId, {
        title: 'Caregiver unavailable',
        body: `${caregiver.name} was deactivated. Please reassign ${parent.name}.`,
        link: `/care-manager/parents/${parent.id}`,
      }),
    ),
  );
}

export async function updateUser(req, res) {
  if (req.params.id === req.user.id) {
    throw new ApiError(409, 'You cannot change your own account here');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: req.body.isActive },
    { returnDocument: 'after' },
  );
  if (!user) throw new ApiError(404, 'We could not find that user');

  if (!user.isActive) {
    disconnectUser(user.id);
    if (user.role === 'careManager') await redistributeFamilies(user.id);
    if (user.role === 'caregiver') await warnCareManagers(user);
  }

  res.json({ user: toAdminUser(user) });
}

export async function listCareManagers(req, res) {
  const managers = await User.find({ role: 'careManager' }).sort({ name: 1 });

  const rows = await Promise.all(
    managers.map(async (manager) => ({
      ...toAdminUser(manager),
      families: (await Parent.distinct('customerId', { careManagerId: manager.id })).length,
    })),
  );
  res.json({ careManagers: rows });
}

export async function createCareManager(req, res) {
  const { name, email, phone, password } = req.body;

  const user = await User.create({
    name,
    email,
    phone,
    role: 'careManager',
    isVerified: true,
    passwordHash: await bcrypt.hash(password, 12),
  });
  res.status(201).json({ careManager: { ...toAdminUser(user), families: 0 } });
}

export async function listAllBookings(req, res) {
  const { status } = req.validQuery;

  const bookings = await Booking.find(status ? { status } : {})
    .sort({ scheduledAt: -1 })
    .limit(100)
    .populate('customerId', 'name')
    .populate('caregiverId', 'name')
    .populate('parentId', 'name');

  res.json({
    bookings: bookings.map((booking) => ({
      id: booking.id,
      label: SERVICE_CATALOG[booking.serviceType].label,
      status: booking.status,
      scheduledAt: booking.scheduledAt,
      customerName: booking.customerId?.name ?? 'Deleted account',
      caregiverName: booking.caregiverId?.name ?? 'Former caregiver',
      parentName: booking.parentId?.name ?? 'Removed parent',
      paymentStatus: booking.paymentStatus,
      price: booking.price,
      currency: booking.currency,
    })),
  });
}

export async function listCaregivers(req, res) {
  const profiles = await CaregiverProfile.find({ verificationStatus: req.validQuery.status })
    .sort({ submittedAt: 1 })
    .populate('userId', 'name email');

  res.json({
    caregivers: profiles
      .filter(({ userId }) => userId)
      .map((profile) => ({
        id: profile.userId.id,
        name: profile.userId.name,
        email: profile.userId.email,
        area: profile.area ?? '',
        documentCount: profile.documents.length,
        status: profile.verificationStatus,
        submittedAt: profile.submittedAt ?? null,
      })),
  });
}

function toReview(profile) {
  const user = profile.userId;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    bio: profile.bio ?? '',
    services: profile.services,
    experienceYears: profile.experienceYears,
    languages: profile.languages,
    certificates: profile.certificates,
    area: profile.area ?? '',
    location: fromPoint(profile.location),
    serviceRadiusKm: profile.serviceRadiusKm,
    availability: profile.availability,
    hasPhoto: Boolean(profile.photo?.file),
    documents: profile.documents.map(({ id, type, name, createdAt }) => ({ id, type, name, createdAt })),
    status: profile.verificationStatus,
    rejectionReason: profile.rejectionReason ?? null,
    submittedAt: profile.submittedAt ?? null,
  };
}

const findProfileForReview = async (userId) => {
  const profile = await CaregiverProfile.findOne({ userId }).populate('userId', 'name email phone');
  if (!profile) throw new ApiError(404, 'We could not find that caregiver');
  return profile;
};

export async function getCaregiverForReview(req, res) {
  res.json({ caregiver: toReview(await findProfileForReview(req.params.id)) });
}

export async function verifyCaregiver(req, res) {
  const profile = await findProfileForReview(req.params.id);
  const approved = req.body.action === 'approve';

  if (profile.verificationStatus === 'draft') {
    throw new ApiError(409, 'This caregiver has not submitted their profile yet');
  }

  profile.verificationStatus = approved ? 'approved' : 'rejected';
  profile.policeVerified = approved;
  profile.rejectionReason = approved ? undefined : req.body.reason;
  await profile.save();
  await User.updateOne({ _id: req.params.id }, { isVerified: approved });
  await notify(req.params.id, {
    title: approved ? 'You are verified' : 'Your profile needs changes',
    body: approved ? 'Families near you can now find and choose you.' : req.body.reason,
    link: approved ? '/caregiver' : '/caregiver/profile',
  });

  res.json({ caregiver: toReview(profile) });
}

export async function listAllPlans(req, res) {
  const plans = await Plan.find().sort({ priceInr: 1 });
  res.json({ plans: plans.map((plan) => plan.toPublic()) });
}

export async function updatePlan(req, res) {
  const plan = await Plan.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!plan) throw new ApiError(404, 'We could not find that plan');
  res.json({ plan: plan.toPublic() });
}

export async function listEmployerCodes(req, res) {
  const codes = await EmployerCode.find().sort({ createdAt: -1 });
  res.json({ employerCodes: codes.map((code) => code.toPublic()) });
}

export async function createEmployerCode(req, res) {
  const { code, company, employeeCount } = req.body;
  const employerCode = await EmployerCode.create({
    code,
    company,
    employeeCount,
    discountPct: discountForEmployees(employeeCount),
  });
  res.status(201).json({ employerCode: employerCode.toPublic() });
}

export async function updateEmployerCode(req, res) {
  const employerCode = await EmployerCode.findByIdAndUpdate(
    req.params.id,
    { active: req.body.active },
    { returnDocument: 'after' },
  );
  if (!employerCode) throw new ApiError(404, 'We could not find that employer code');
  res.json({ employerCode: employerCode.toPublic() });
}
