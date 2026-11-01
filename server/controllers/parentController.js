import { Assignment } from '../models/Assignment.js';
import { Booking } from '../models/Booking.js';
import { Parent } from '../models/Parent.js';
import { fromPoint, toPoint } from '../models/point.js';
import { Review } from '../models/Review.js';
import { Subscription } from '../models/Subscription.js';
import { ApiError } from '../utils/ApiError.js';
import { chooseCareManager } from '../utils/careManagers.js';
import { istMonth } from '../utils/time.js';

const RUNNING = ['trial', 'active'];
const OPEN_BOOKINGS = ['REQUESTED', 'ACCEPTED', 'APPOINTMENT_FIXED', 'IN_PROGRESS'];

const person = (user) => (user ? { id: user.id, name: user.name, phone: user.phone } : null);

const withPeople = (query) =>
  query
    .populate('primaryCaregiverId', 'name phone')
    .populate('backupCaregiverId', 'name phone')
    .populate('careManagerId', 'name phone');

async function toPublicList(parents, customerId) {
  const ids = parents.map((parent) => parent.id);

  const [subscriptions, requests, reviewed] = await Promise.all([
    Subscription.find({ customerId, status: { $in: RUNNING } }).populate('planId', 'name'),
    Assignment.find({ parentId: { $in: ids }, type: 'primary' })
      .sort({ createdAt: -1 })
      .populate('caregiverId', 'name'),
    Review.distinct('caregiverId', { customerId, month: istMonth() }),
  ]);
  const reviewedIds = new Set(reviewed.map(String));

  const planNames = new Map(subscriptions.map((sub) => [String(sub.parentId), sub.planId?.name]));
  const latestRequests = new Map();
  for (const request of requests) {
    if (!latestRequests.has(String(request.parentId))) latestRequests.set(String(request.parentId), request);
  }

  return parents.map((parent) => {
    const request = latestRequests.get(parent.id);
    const showRequest = request && ['pending', 'declined'].includes(request.status);

    return {
      id: parent.id,
      name: parent.name,
      age: parent.age ?? null,
      address: parent.address ?? '',
      location: fromPoint(parent.location),
      conditions: parent.conditions,
      allergies: parent.allergies,
      emergencyContact: parent.emergencyContact?.name ? parent.emergencyContact : null,
      profileComplete: Boolean(parent.location && parent.address && parent.emergencyContact?.name),
      hasActivePlan: planNames.has(parent.id),
      planName: planNames.get(parent.id) ?? null,
      primaryCaregiver: person(parent.primaryCaregiverId),
      canReviewPrimary:
        Boolean(parent.primaryCaregiverId) && !reviewedIds.has(parent.primaryCaregiverId.id),
      backupCaregiver: person(parent.backupCaregiverId),
      careManager: person(parent.careManagerId),
      request: showRequest
        ? { status: request.status, caregiverName: request.caregiverId?.name ?? 'The caregiver' }
        : null,
    };
  });
}

function toDocument({ location, ...details }) {
  return { ...details, ...(location && { location: toPoint(location) }) };
}

export async function listParents(req, res) {
  const parents = await withPeople(Parent.find({ customerId: req.user.id }).sort({ createdAt: 1 }));
  res.json({ parents: await toPublicList(parents, req.user.id) });
}

export async function getParent(req, res) {
  const parent = await withPeople(Parent.findOne({ _id: req.params.id, customerId: req.user.id }));
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  const [publicParent] = await toPublicList([parent], req.user.id);
  res.json({ parent: publicParent });
}

export async function createParent(req, res) {
  const parent = await Parent.create({
    ...toDocument(req.body),
    customerId: req.user.id,
    careManagerId: await chooseCareManager(req.user.id),
  });

  const [publicParent] = await toPublicList([await withPeople(Parent.findById(parent.id))], req.user.id);
  res.status(201).json({ parent: publicParent });
}

export async function updateParent(req, res) {
  const parent = await Parent.findOne({ _id: req.params.id, customerId: req.user.id });
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  parent.set(toDocument(req.body));
  parent.careManagerId ??= await chooseCareManager(req.user.id);
  await parent.save();

  const [publicParent] = await toPublicList([await withPeople(Parent.findById(parent.id))], req.user.id);
  res.json({ parent: publicParent });
}

export async function deleteParent(req, res) {
  const parent = await Parent.findOne({ _id: req.params.id, customerId: req.user.id });
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  if (await Subscription.exists({ parentId: parent.id, status: { $in: RUNNING } })) {
    throw new ApiError(409, "Cancel this parent's plan before removing them");
  }
  if (await Booking.exists({ parentId: parent.id, status: { $in: OPEN_BOOKINGS } })) {
    throw new ApiError(409, "Cancel this parent's open bookings before removing them");
  }

  await Assignment.updateMany(
    { parentId: parent.id, status: { $in: ['pending', 'accepted'] } },
    { status: 'cancelled' },
  );
  await parent.deleteOne();
  res.status(204).end();
}
