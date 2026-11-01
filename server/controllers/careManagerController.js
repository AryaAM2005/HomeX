import { Alert } from '../models/Alert.js';
import { CheckIn } from '../models/CheckIn.js';
import { Parent } from '../models/Parent.js';
import { fromPoint } from '../models/point.js';
import { Subscription } from '../models/Subscription.js';
import { ApiError } from '../utils/ApiError.js';

const ACTIVE_ALERTS = ['open', 'acknowledged'];

const person = (user) => (user ? { id: user.id, name: user.name, phone: user.phone } : null);

const withPeople = (query) =>
  query
    .populate('customerId', 'name phone email country timezone')
    .populate('primaryCaregiverId', 'name phone')
    .populate('backupCaregiverId', 'name phone');

async function loadPlanNames(parentIds) {
  const subscriptions = await Subscription.find({
    parentId: { $in: parentIds },
    status: { $in: ['trial', 'active'] },
  }).populate('planId', 'name');

  return new Map(subscriptions.map(({ parentId, planId }) => [String(parentId), planId?.name]));
}

export async function listFamilies(req, res) {
  const parents = await withPeople(
    Parent.find({ careManagerId: req.user.id }).sort({ name: 1 }),
  );
  const ids = parents.map(({ id }) => id);

  const [planNames, alerts, checkIns] = await Promise.all([
    loadPlanNames(ids),
    Alert.find({ parentId: { $in: ids }, status: { $in: ACTIVE_ALERTS } }, 'parentId'),
    CheckIn.aggregate([
      { $match: { parentId: { $in: parents.map(({ _id }) => _id) } } },
      { $group: { _id: '$parentId', latest: { $max: '$time' } } },
    ]),
  ]);

  const families = new Map();

  for (const parent of parents) {
    const { customerId: customer } = parent;
    if (!customer) continue;

    if (!families.has(customer.id)) {
      families.set(customer.id, {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        country: customer.country,
        parents: [],
      });
    }

    families.get(customer.id).parents.push({
      id: parent.id,
      name: parent.name,
      age: parent.age ?? null,
      planName: planNames.get(parent.id) ?? null,
      primaryCaregiver: person(parent.primaryCaregiverId),
      backupCaregiver: person(parent.backupCaregiverId),
      activeAlerts: alerts.filter(({ parentId }) => parentId.equals(parent.id)).length,
      latestCheckIn: checkIns.find(({ _id }) => _id.equals(parent.id))?.latest ?? null,
    });
  }

  res.json({ families: [...families.values()] });
}

export async function getParentDetail(req, res) {
  const parent = await withPeople(
    Parent.findOne({ _id: req.params.id, careManagerId: req.user.id }),
  );
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  const planNames = await loadPlanNames([parent.id]);
  const { customerId: family } = parent;

  res.json({
    parent: {
      id: parent.id,
      name: parent.name,
      age: parent.age ?? null,
      address: parent.address ?? '',
      location: fromPoint(parent.location),
      conditions: parent.conditions,
      allergies: parent.allergies,
      emergencyContact: parent.emergencyContact?.name ? parent.emergencyContact : null,
      planName: planNames.get(parent.id) ?? null,
      primaryCaregiver: person(parent.primaryCaregiverId),
      backupCaregiver: person(parent.backupCaregiverId),
      family: family && {
        name: family.name,
        phone: family.phone,
        email: family.email,
        country: family.country,
        timezone: family.timezone,
      },
    },
  });
}
