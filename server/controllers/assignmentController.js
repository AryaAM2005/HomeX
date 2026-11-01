import { Assignment } from '../models/Assignment.js';
import { Booking } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { Parent } from '../models/Parent.js';
import { fromPoint } from '../models/point.js';
import { Subscription } from '../models/Subscription.js';
import { ApiError } from '../utils/ApiError.js';
import { distanceKm } from '../utils/geo.js';
import { notify } from '../utils/notifications.js';

const FIELD_FOR_TYPE = { primary: 'primaryCaregiverId', backup: 'backupCaregiverId' };

async function findManagedParent(parentId, user) {
  const ownerCheck =
    user.role === 'careManager' ? { careManagerId: user.id } : { customerId: user.id };
  const parent = await Parent.findOne({ _id: parentId, ...ownerCheck });
  if (!parent) throw new ApiError(404, 'We could not find that parent');
  return parent;
}

async function findApprovedCaregiver(caregiverId) {
  const profile = await CaregiverProfile.findOne({
    userId: caregiverId,
    verificationStatus: 'approved',
  }).populate('userId', 'isActive');

  if (!profile?.userId?.isActive) throw new ApiError(404, 'This caregiver is not available');
  return profile;
}

async function makeAssignmentCurrent(assignment, parent) {
  const field = FIELD_FOR_TYPE[assignment.type];

  await Assignment.updateMany(
    {
      parentId: parent.id,
      type: assignment.type,
      status: 'accepted',
      _id: { $ne: assignment.id },
    },
    { status: 'ended' },
  );
  await Parent.updateOne({ _id: parent.id }, { [field]: assignment.caregiverId });
}

async function requestAsCustomer(req, res, parent, profile) {
  const { caregiverId } = req.body;

  if (!(await Subscription.exists({ parentId: parent.id, status: { $in: ['trial', 'active'] } }))) {
    throw new ApiError(409, 'Start a plan for this parent before choosing a caregiver');
  }
  if (!parent.location) {
    throw new ApiError(409, "Add your parent's address and map pin first");
  }
  if (parent.primaryCaregiverId?.equals(caregiverId)) {
    throw new ApiError(409, "This caregiver is already your parent's primary caregiver");
  }

  const distance = distanceKm(fromPoint(parent.location), fromPoint(profile.location));
  if (distance > profile.serviceRadiusKm) {
    throw new ApiError(409, "This caregiver does not cover your parent's area");
  }

  await Assignment.updateMany(
    { parentId: parent.id, type: 'primary', status: 'pending' },
    { status: 'cancelled' },
  );
  const assignment = await Assignment.create({
    parentId: parent.id,
    customerId: parent.customerId,
    caregiverId,
    requestedBy: req.user.id,
    type: 'primary',
  });
  await notify(caregiverId, {
    title: 'New care request',
    body: `A family has asked you to care for ${parent.name}.`,
    link: '/caregiver/requests',
  });

  res.status(201).json({ assignment: { id: assignment.id, status: assignment.status } });
}

// Care managers arrange this with the caregiver themselves, so it applies straight away.
async function assignAsCareManager(req, res, parent) {
  const { caregiverId, type } = req.body;
  const previousId = parent[FIELD_FOR_TYPE[type]];

  if (previousId?.equals(caregiverId)) {
    throw new ApiError(409, `This caregiver is already the ${type} caregiver`);
  }
  const otherType = type === 'primary' ? 'backup' : 'primary';
  if (parent[FIELD_FOR_TYPE[otherType]]?.equals(caregiverId)) {
    throw new ApiError(409, `This caregiver is already the ${otherType} caregiver`);
  }

  await Assignment.updateMany({ parentId: parent.id, type, status: 'pending' }, { status: 'cancelled' });
  const assignment = await Assignment.create({
    parentId: parent.id,
    customerId: parent.customerId,
    caregiverId,
    requestedBy: req.user.id,
    type,
    status: 'accepted',
    respondedAt: new Date(),
  });
  await makeAssignmentCurrent(assignment, parent);

  await Promise.all([
    notify(caregiverId, {
      title: 'New family',
      body: `You are now the ${type} caregiver for ${parent.name}.`,
      link: '/caregiver/requests',
    }),
    notify(previousId, {
      title: 'Family reassigned',
      body: `You are no longer the ${type} caregiver for ${parent.name}.`,
      link: '/caregiver/requests',
    }),
    notify(parent.customerId, {
      title: 'Caregiver changed',
      body: `Your care manager updated the ${type} caregiver for ${parent.name}.`,
      link: '/parents',
    }),
  ]);

  res.status(201).json({ assignment: { id: assignment.id, status: assignment.status } });
}

export async function assignCaregiver(req, res) {
  const parent = await findManagedParent(req.params.id, req.user);
  const profile = await findApprovedCaregiver(req.body.caregiverId);

  if (req.user.role === 'careManager') return assignAsCareManager(req, res, parent);
  if (req.body.type !== 'primary') {
    throw new ApiError(403, 'Your care manager assigns the backup caregiver');
  }
  return requestAsCustomer(req, res, parent, profile);
}

export async function cancelRequest(req, res) {
  const parent = await findManagedParent(req.params.id, req.user);
  await Assignment.updateMany(
    { parentId: parent.id, status: 'pending' },
    { status: 'cancelled' },
  );
  res.status(204).end();
}

export async function listMyRequests(req, res) {
  const [requests, families] = await Promise.all([
    Assignment.find({ caregiverId: req.user.id, status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('parentId', 'name age location')
      .populate('customerId', 'name'),
    Parent.find({
      $or: [{ primaryCaregiverId: req.user.id }, { backupCaregiverId: req.user.id }],
    }).populate('customerId', 'name phone'),
  ]);

  const profile = await CaregiverProfile.findOne({ userId: req.user.id });
  const home = fromPoint(profile?.location);

  res.json({
    // Health details and the exact address stay hidden until the caregiver accepts.
    requests: requests
      .filter(({ parentId }) => parentId)
      .map(({ id, parentId: parent, customerId: customer, createdAt }) => ({
        id,
        parentName: parent.name,
        age: parent.age ?? null,
        familyName: customer.name.split(' ')[0],
        distanceKm:
          home && parent.location
            ? Math.round(distanceKm(home, fromPoint(parent.location)) * 10) / 10
            : null,
        date: createdAt,
      })),
    families: families.map((parent) => ({
      id: parent.id,
      name: parent.name,
      age: parent.age ?? null,
      address: parent.address ?? '',
      conditions: parent.conditions,
      allergies: parent.allergies,
      emergencyContact: parent.emergencyContact?.name ? parent.emergencyContact : null,
      role: parent.primaryCaregiverId?.equals(req.user.id) ? 'primary' : 'backup',
      family: { name: parent.customerId.name, phone: parent.customerId.phone },
    })),
  });
}

export async function respondToRequest(req, res) {
  const accepted = req.body.action === 'accept';

  const assignment = await Assignment.findOneAndUpdate(
    { _id: req.params.id, caregiverId: req.user.id, status: 'pending' },
    { status: accepted ? 'accepted' : 'declined', respondedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!assignment) throw new ApiError(404, 'This request is no longer open');

  if (accepted) await makeAssignmentCurrent(assignment, { id: assignment.parentId });

  const parent = await Parent.findById(assignment.parentId, 'name');
  await notify(assignment.customerId, {
    title: accepted ? 'Caregiver accepted' : 'Caregiver declined',
    body: accepted
      ? `${req.user.name} will now care for ${parent?.name}.`
      : `${req.user.name} could not take this on. Please choose someone else for ${parent?.name}.`,
    link: '/parents',
  });

  res.json({ assignment: { id: assignment.id, status: assignment.status } });
}

export async function canSeeCaregiverPhone(user, caregiverId) {
  if (user.role === 'admin') return true;

  const scope = user.role === 'careManager' ? { careManagerId: user.id } : { customerId: user.id };
  const isAssigned = await Parent.exists({
    ...scope,
    $or: [{ primaryCaregiverId: caregiverId }, { backupCaregiverId: caregiverId }],
  });
  if (isAssigned || user.role !== 'customer') return Boolean(isAssigned);

  return Boolean(
    await Booking.exists({
      customerId: user.id,
      caregiverId,
      status: { $in: ['ACCEPTED', 'APPOINTMENT_FIXED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_SUBMITTED'] },
    }),
  );
}
