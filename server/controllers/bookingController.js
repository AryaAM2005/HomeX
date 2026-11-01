import { Booking } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { CareReport } from '../models/CareReport.js';
import { Complaint } from '../models/Complaint.js';
import { Parent } from '../models/Parent.js';
import { fromPoint } from '../models/point.js';
import { Review } from '../models/Review.js';
import { Subscription } from '../models/Subscription.js';
import { emitToUsers } from '../sockets/index.js';
import { ApiError } from '../utils/ApiError.js';
import { chargeForVisit, quoteVisit, refundVisit } from '../utils/billing.js';
import { distanceKm } from '../utils/geo.js';
import { notify } from '../utils/notifications.js';
import { caregiverEarning, isIncludedInPlan, SERVICE_CATALOG } from '../utils/services.js';
import { istMonth, istTime, istWeekday } from '../utils/time.js';

const MIN_NOTICE_MS = 60 * 60 * 1000;
const ACCEPTED_STATUSES = [
  'ACCEPTED',
  'APPOINTMENT_FIXED',
  'IN_PROGRESS',
  'COMPLETED',
  'REPORT_SUBMITTED',
];
const FINISHED_STATUSES = ['COMPLETED', 'REPORT_SUBMITTED'];

const TRANSITIONS = {
  accept: { from: ['REQUESTED'], to: 'ACCEPTED', role: 'caregiver' },
  reject: { from: ['REQUESTED'], to: 'REJECTED', role: 'caregiver' },
  fix_appointment: { from: ['ACCEPTED'], to: 'APPOINTMENT_FIXED', role: 'caregiver' },
  start: { from: ['ACCEPTED', 'APPOINTMENT_FIXED'], to: 'IN_PROGRESS', role: 'caregiver' },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED', role: 'caregiver' },
  cancel: { from: ['REQUESTED', 'ACCEPTED', 'APPOINTMENT_FIXED'], to: 'CANCELLED', role: 'customer' },
};

const STATUS_NOTICES = {
  ACCEPTED: 'accepted your booking',
  REJECTED: 'could not take your booking. Any payment has been refunded',
  APPOINTMENT_FIXED: 'fixed the appointment',
  IN_PROGRESS: 'has started the visit',
  COMPLETED: 'has finished the visit',
};

async function findOwnParent(parentId, customerId) {
  const parent = await Parent.findOne({ _id: parentId, customerId });
  if (!parent) throw new ApiError(404, 'We could not find that parent');
  return parent;
}

async function findIncludedPlan(parentId, serviceType) {
  const subscription = await Subscription.findOne({
    parentId,
    status: { $in: ['trial', 'active'] },
  }).populate('planId', 'name');

  const planName = subscription?.planId?.name;
  return isIncludedInPlan(planName, serviceType) ? planName : null;
}

function toQuote(serviceType, currency, includedIn, credit) {
  const service = SERVICE_CATALOG[serviceType];
  const price = quoteVisit(serviceType, currency, includedIn ? 0 : credit);

  return {
    serviceType,
    label: service.label,
    currency,
    includedIn,
    base: price.base,
    creditApplied: price.creditApplied,
    total: includedIn ? 0 : price.total,
  };
}

export async function getBookingQuote(req, res) {
  const { parentId, serviceType, currency } = req.body;
  const parent = await findOwnParent(parentId, req.user.id);
  const includedIn = await findIncludedPlan(parent.id, serviceType);

  res.json({ quote: toQuote(serviceType, currency, includedIn, req.user.credit) });
}

async function findBookableCaregiver(caregiverId, parent, serviceType) {
  const profile = await CaregiverProfile.findOne({
    userId: caregiverId,
    verificationStatus: 'approved',
  }).populate('userId', 'name isActive');

  if (!profile?.userId?.isActive) throw new ApiError(404, 'This caregiver is not available');

  const { offeredAs } = SERVICE_CATALOG[serviceType];
  if (offeredAs && !profile.services.includes(offeredAs)) {
    throw new ApiError(409, 'This caregiver does not offer that service', {
      caregiverId: 'This caregiver does not offer that service',
    });
  }

  const distance = distanceKm(fromPoint(parent.location), fromPoint(profile.location));
  if (distance > profile.serviceRadiusKm) {
    throw new ApiError(409, "This caregiver does not cover your parent's area");
  }
  return profile;
}

function checkSchedule(profile, serviceType, scheduledAt) {
  const isEmergency = serviceType === 'emergency_visit';
  const earliest = Date.now() + (isEmergency ? -5 * 60 * 1000 : MIN_NOTICE_MS);

  if (scheduledAt.getTime() < earliest) {
    const message = 'Choose a time at least 1 hour from now';
    throw new ApiError(400, message, { scheduledAt: message });
  }
  if (isEmergency) return;

  const time = istTime(scheduledAt);
  const slot = profile.availability.find(({ day }) => day === istWeekday(scheduledAt));
  if (!slot || time < slot.start || time > slot.end) {
    const message = "That is outside this caregiver's working hours";
    throw new ApiError(409, message, { scheduledAt: message });
  }
}

function historyEntry(status, by, note) {
  return { status, by, note: note || undefined, at: new Date() };
}

export async function createBooking(req, res) {
  const { parentId, caregiverId, serviceType, currency, notes } = req.body;
  const scheduledAt = new Date(req.body.scheduledAt);

  const parent = await findOwnParent(parentId, req.user.id);
  if (!parent.location) throw new ApiError(409, "Add your parent's address and map pin first");

  const profile = await findBookableCaregiver(caregiverId, parent, serviceType);
  checkSchedule(profile, serviceType, scheduledAt);

  const includedIn = await findIncludedPlan(parent.id, serviceType);
  const quote = toQuote(serviceType, currency, includedIn, req.user.credit);

  const booking = await Booking.create({
    customerId: req.user.id,
    parentId: parent.id,
    caregiverId,
    serviceType,
    scheduledAt,
    notes,
    currency,
    price: quote.base,
    paymentStatus: includedIn ? 'included' : 'paid',
    caregiverEarningInr: caregiverEarning(serviceType),
    statusHistory: [historyEntry('REQUESTED', req.user.name)],
  });

  if (!includedIn) {
    const payment = await chargeForVisit({ customer: req.user, booking });
    booking.paymentId = payment.id;
    await booking.save();
  }

  await notify(caregiverId, {
    title: 'New booking request',
    body: `${SERVICE_CATALOG[serviceType].label} for ${parent.name}.`,
    link: '/caregiver/bookings',
  });
  emitToUsers([caregiverId, req.user.id], 'booking:updated', { id: booking.id });

  res.status(201).json({ booking: { id: booking.id, status: booking.status } });
}

function toCommonView(booking, extras) {
  const service = SERVICE_CATALOG[booking.serviceType];

  return {
    id: booking.id,
    serviceType: booking.serviceType,
    label: service.label,
    needsAppointment: service.medical,
    needsReport: service.medical,
    scheduledAt: booking.scheduledAt,
    status: booking.status,
    statusHistory: booking.statusHistory,
    notes: booking.notes ?? '',
    appointmentDetails: booking.appointmentDetails ?? '',
    reportId: extras.reports.get(booking.id) ?? null,
  };
}

function toCustomerView(booking, extras) {
  const { caregiverId: caregiver, parentId: parent } = booking;
  const complaint = extras.complaints.get(booking.id);

  return {
    ...toCommonView(booking, extras),
    parent: { id: parent?.id ?? null, name: parent?.name ?? 'Removed parent' },
    // The caregiver may have closed their account since.
    caregiver: {
      id: caregiver?.id ?? null,
      name: caregiver?.name ?? 'Former caregiver',
      phone: caregiver && ACCEPTED_STATUSES.includes(booking.status) ? caregiver.phone : null,
    },
    currency: booking.currency,
    price: booking.price,
    paymentStatus: booking.paymentStatus,
    canReview:
      Boolean(caregiver) &&
      FINISHED_STATUSES.includes(booking.status) &&
      !extras.reviewed.has(booking.id),
    complaint: complaint
      ? { status: complaint.status, resolution: complaint.resolution ?? null }
      : null,
  };
}

function toCaregiverView(booking, extras) {
  const { parentId: parent, customerId: customer } = booking;
  const accepted = ACCEPTED_STATUSES.includes(booking.status);
  const parentName = parent?.name ?? 'Removed parent';

  return {
    ...toCommonView(booking, extras),
    earningInr: booking.caregiverEarningInr,
    // Details stay hidden until the caregiver takes the booking on.
    parent: accepted
      ? {
          name: parentName,
          age: parent?.age ?? null,
          address: parent?.address ?? '',
          conditions: parent?.conditions ?? [],
          allergies: parent?.allergies ?? [],
          emergencyContact: parent?.emergencyContact?.name ? parent.emergencyContact : null,
        }
      : { name: parentName.split(' ')[0], age: parent?.age ?? null },
    // The family may have deleted their account since.
    family: accepted && customer ? { name: customer.name, phone: customer.phone } : null,
  };
}

export async function listBookings(req, res) {
  const scope =
    req.user.role === 'customer' ? { customerId: req.user.id } : { caregiverId: req.user.id };

  const bookings = await Booking.find(scope)
    .sort({ scheduledAt: -1 })
    .limit(100)
    .populate('parentId', 'name age address conditions allergies emergencyContact')
    .populate('caregiverId', 'name phone')
    .populate('customerId', 'name phone');

  const ids = bookings.map(({ id }) => id);
  const [reports, reviews, complaints] = await Promise.all([
    CareReport.find({ bookingId: { $in: ids } }, 'bookingId'),
    Review.find({ bookingId: { $in: ids } }, 'bookingId'),
    Complaint.find({ bookingId: { $in: ids } }).sort({ createdAt: 1 }),
  ]);
  const extras = {
    reports: new Map(reports.map(({ id, bookingId }) => [String(bookingId), id])),
    reviewed: new Set(reviews.map(({ bookingId }) => String(bookingId))),
    complaints: new Map(complaints.map((complaint) => [String(complaint.bookingId), complaint])),
  };

  const toView = req.user.role === 'customer' ? toCustomerView : toCaregiverView;
  res.json({ bookings: bookings.map((booking) => toView(booking, extras)) });
}

export async function changeBookingStatus(req, res) {
  const { action, note } = req.body;
  const transition = TRANSITIONS[action];

  if (transition.role !== req.user.role) {
    throw new ApiError(403, 'You cannot make that change');
  }

  const owner =
    req.user.role === 'customer' ? { customerId: req.user.id } : { caregiverId: req.user.id };
  const current = await Booking.findOne({ _id: req.params.id, ...owner });
  if (!current) throw new ApiError(404, 'We could not find that booking');

  // Only doctor and lab visits have an appointment to fix.
  const skipsAppointment = !SERVICE_CATALOG[current.serviceType].medical;
  if (action === 'fix_appointment' && skipsAppointment) {
    throw new ApiError(409, 'This service has no appointment to fix');
  }
  if (action === 'start' && !skipsAppointment && current.status === 'ACCEPTED') {
    throw new ApiError(409, 'Fix the appointment before starting');
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: current.id, status: { $in: transition.from } },
    {
      status: transition.to,
      ...(action === 'fix_appointment' && { appointmentDetails: note }),
      $push: { statusHistory: historyEntry(transition.to, req.user.name, note) },
    },
    { returnDocument: 'after' },
  );
  if (!booking) throw new ApiError(409, 'This booking has already moved on. Refresh to see the latest.');

  if (['REJECTED', 'CANCELLED'].includes(booking.status) && booking.paymentId) {
    await refundVisit(booking.paymentId);
    await Booking.updateOne({ _id: booking.id }, { paymentStatus: 'refunded' });
  }

  const label = SERVICE_CATALOG[booking.serviceType].label;
  if (req.user.role === 'caregiver') {
    await notify(booking.customerId, {
      title: `Booking: ${label}`,
      body: `${req.user.name} ${STATUS_NOTICES[booking.status]}.`,
      link: '/bookings',
    });
  } else {
    await notify(booking.caregiverId, {
      title: 'Booking cancelled',
      body: `The family cancelled the ${label.toLowerCase()}.`,
      link: '/caregiver/bookings',
    });
  }
  emitToUsers([booking.customerId, booking.caregiverId], 'booking:updated', { id: booking.id });

  res.json({ booking: { id: booking.id, status: booking.status } });
}

export async function getEarnings(req, res) {
  const bookings = await Booking.find({
    caregiverId: req.user.id,
    status: { $in: FINISHED_STATUSES },
  })
    .sort({ scheduledAt: -1 })
    .populate('parentId', 'name');

  const sum = (items) => items.reduce((total, item) => total + item.caregiverEarningInr, 0);
  const thisMonth = bookings.filter(({ scheduledAt }) => istMonth(scheduledAt) === istMonth());

  res.json({
    totalInr: sum(bookings),
    thisMonthInr: sum(thisMonth),
    completedCount: bookings.length,
    items: bookings.slice(0, 50).map((booking) => ({
      id: booking.id,
      label: SERVICE_CATALOG[booking.serviceType].label,
      parentName: booking.parentId?.name ?? 'Removed parent',
      date: booking.scheduledAt,
      earningInr: booking.caregiverEarningInr,
    })),
  });
}

// Used by the job that clears requests nobody answered before their time.
export async function expireBooking(booking) {
  const expired = await Booking.findOneAndUpdate(
    { _id: booking.id, status: 'REQUESTED' },
    {
      status: 'REJECTED',
      $push: { statusHistory: historyEntry('REJECTED', 'HOMEX', 'No answer before the visit time') },
    },
    { returnDocument: 'after' },
  );
  if (!expired) return;

  if (expired.paymentId) {
    await refundVisit(expired.paymentId);
    await Booking.updateOne({ _id: expired.id }, { paymentStatus: 'refunded' });
  }

  await notify(expired.customerId, {
    title: 'Booking not accepted',
    body: `Nobody answered your ${SERVICE_CATALOG[expired.serviceType].label.toLowerCase()} request in time. Any payment has been refunded.`,
    link: '/bookings',
  });
  emitToUsers([expired.customerId, expired.caregiverId], 'booking:updated', { id: expired.id });
}
