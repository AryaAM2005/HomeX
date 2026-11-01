import { Booking } from '../models/Booking.js';
import { Complaint } from '../models/Complaint.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from '../utils/notifications.js';
import { SERVICE_CATALOG } from '../utils/services.js';

export async function createComplaint(req, res) {
  const { bookingId, message } = req.body;

  const booking = await Booking.findOne({ _id: bookingId, customerId: req.user.id });
  if (!booking) throw new ApiError(404, 'We could not find that booking');

  try {
    const complaint = await Complaint.create({ customerId: req.user.id, bookingId, message });
    const admins = await User.find({ role: 'admin', isActive: true }, '_id');
    await Promise.all(
      admins.map(({ id }) =>
        notify(id, {
          title: 'New complaint',
          body: `${req.user.name} raised a complaint about a booking.`,
          link: '/admin/complaints',
        }),
      ),
    );
    res.status(201).json({ complaint: { id: complaint.id, status: complaint.status } });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'This booking already has an open complaint');
    throw err;
  }
}

function toAdminView(complaint) {
  const { customerId: customer, bookingId: booking } = complaint;

  return {
    id: complaint.id,
    message: complaint.message,
    status: complaint.status,
    resolution: complaint.resolution ?? null,
    createdAt: complaint.createdAt,
    resolvedAt: complaint.resolvedAt ?? null,
    customer: customer && { name: customer.name, phone: customer.phone, email: customer.email },
    booking: booking && {
      label: SERVICE_CATALOG[booking.serviceType]?.label ?? 'Visit',
      scheduledAt: booking.scheduledAt,
      status: booking.status,
      caregiverName: booking.caregiverId?.name ?? 'Former caregiver',
    },
  };
}

export async function listComplaints(req, res) {
  const complaints = await Complaint.find({ status: req.validQuery.status })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('customerId', 'name phone email')
    .populate({
      path: 'bookingId',
      select: 'serviceType scheduledAt status caregiverId',
      populate: { path: 'caregiverId', select: 'name' },
    });

  res.json({ complaints: complaints.map(toAdminView) });
}

export async function resolveComplaint(req, res) {
  const complaint = await Complaint.findOneAndUpdate(
    { _id: req.params.id, status: 'open' },
    { status: 'resolved', resolution: req.body.resolution, resolvedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!complaint) throw new ApiError(409, 'This complaint has already been resolved');

  await notify(complaint.customerId, {
    title: 'Your complaint was resolved',
    body: req.body.resolution,
    link: '/bookings',
  });

  res.json({ complaint: { id: complaint.id, status: complaint.status } });
}
