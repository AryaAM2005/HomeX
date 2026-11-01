import crypto from 'node:crypto';
import { Alert } from '../models/Alert.js';
import { Parent } from '../models/Parent.js';
import { announceUpdate, raiseAlert, toPublicAlert } from '../utils/alerts.js';
import { ApiError } from '../utils/ApiError.js';
import { findParentFor } from '../utils/parentAccess.js';

const ACTIVE = ['open', 'acknowledged'];
const MESSAGES_BY_SOURCE = {
  customer: 'SOS raised by the family',
  caregiver: 'SOS raised by the caregiver',
  parent: 'SOS raised from the parent’s own SOS page',
};

// A panicked parent may press several times, so one emergency stays one alert.
async function raiseSos(parent, raisedVia, raisedBy, note) {
  const running = await Alert.findOne({
    parentId: parent.id,
    type: 'sos',
    status: { $in: ACTIVE },
  });
  if (running) return { alert: running, created: false };

  const message = note ? `${MESSAGES_BY_SOURCE[raisedVia]}: ${note}` : MESSAGES_BY_SOURCE[raisedVia];
  const alert = await raiseAlert({ parent, type: 'sos', message, raisedBy, raisedVia });
  return { alert, created: true };
}

export async function raiseUserSos(req, res) {
  const parent = await findParentFor(req.user, req.body.parentId);
  const { alert, created } = await raiseSos(parent, req.user.role, req.user.id, req.body.note);

  res.status(created ? 201 : 200).json({ alert: toPublicAlert(alert, parent.name), created });
}

async function findParentByToken(token) {
  const parent = await Parent.findOne({ sosToken: token });
  if (!parent) throw new ApiError(404, 'This SOS link is no longer valid');
  return parent;
}

export async function getPublicSosPage(req, res) {
  const parent = await findParentByToken(req.params.token);
  res.json({ name: parent.name.split(' ')[0] });
}

export async function raisePublicSos(req, res) {
  const parent = await findParentByToken(req.params.token);
  const { created } = await raiseSos(parent, 'parent');
  res.status(created ? 201 : 200).json({ created });
}

export async function getSosLink(req, res) {
  const parent = await Parent.findOne({ _id: req.params.id, customerId: req.user.id }).select(
    '+sosToken',
  );
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  if (!parent.sosToken) {
    parent.sosToken = crypto.randomBytes(24).toString('hex');
    await parent.save();
  }
  res.json({ token: parent.sosToken });
}

export async function resetSosLink(req, res) {
  const parent = await Parent.findOneAndUpdate(
    { _id: req.params.id, customerId: req.user.id },
    { sosToken: crypto.randomBytes(24).toString('hex') },
    { returnDocument: 'after' },
  ).select('+sosToken');
  if (!parent) throw new ApiError(404, 'We could not find that parent');

  res.json({ token: parent.sosToken });
}

function alertScope(user) {
  if (user.role === 'customer') return { customerId: user.id };
  if (user.role === 'careManager') return { careManagerId: user.id };
  return {};
}

export async function listAlerts(req, res) {
  const status = req.validQuery.status === 'active' ? { $in: ACTIVE } : 'resolved';
  // Admins step in on escalations, so routine alerts stay with care managers.
  const escalation = req.user.role === 'admin' ? { escalatedAt: { $exists: true } } : {};
  const alerts = await Alert.find({ ...alertScope(req.user), ...escalation, status })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('parentId', 'name address emergencyContact')
    .populate('customerId', 'name phone');

  const isStaff = req.user.role !== 'customer';

  res.json({
    alerts: alerts.map((alert) => {
      const { parentId: parent, customerId: customer } = alert;
      const publicAlert = toPublicAlert(
        alert.depopulate(['parentId', 'customerId']),
        parent?.name ?? 'Removed parent',
      );

      return isStaff && parent && customer
        ? {
            ...publicAlert,
            contact: {
              address: parent.address ?? '',
              familyName: customer.name,
              familyPhone: customer.phone,
              emergencyContact: parent.emergencyContact?.name ? parent.emergencyContact : null,
            },
          }
        : publicAlert;
    }),
  });
}

export async function updateAlert(req, res) {
  const acknowledging = req.body.action === 'acknowledge';
  const nextStatus = acknowledging ? 'acknowledged' : 'resolved';

  const alert = await Alert.findOneAndUpdate(
    {
      _id: req.params.id,
      ...alertScope(req.user),
      status: acknowledging ? 'open' : 'acknowledged',
    },
    {
      status: nextStatus,
      $push: {
        history: { status: nextStatus, note: req.body.note, by: req.user.name, at: new Date() },
      },
    },
    { returnDocument: 'after' },
  );
  if (!alert) throw new ApiError(409, 'This alert has already moved on. Refresh to see the latest.');

  const parent = await Parent.findById(alert.parentId, 'name');
  announceUpdate(alert, parent?.name ?? 'Removed parent');
  res.json({ alert: toPublicAlert(alert, parent?.name ?? 'Removed parent') });
}
