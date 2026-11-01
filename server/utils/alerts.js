import { Alert } from '../models/Alert.js';
import { User } from '../models/User.js';
import { emitToAdmins, emitToUsers } from './live.js';
import { notify } from './notifications.js';

const TITLES = {
  sos: 'SOS emergency',
  missed_checkin: 'Missed check-in',
  missed_medicine: 'Missed medicine',
  abnormal_vitals: 'Abnormal vitals',
};

const SEVERITY = {
  sos: 'critical',
  abnormal_vitals: 'high',
  missed_medicine: 'medium',
  missed_checkin: 'medium',
};

export function toPublicAlert(alert, parentName) {
  return {
    id: alert.id,
    type: alert.type,
    title: TITLES[alert.type],
    severity: alert.severity,
    status: alert.status,
    message: alert.message,
    raisedVia: alert.raisedVia,
    parent: { id: String(alert.parentId), name: parentName },
    escalated: Boolean(alert.escalatedAt),
    history: alert.history,
    createdAt: alert.createdAt,
  };
}

const recipients = (alert) => [alert.customerId, alert.careManagerId].filter(Boolean);

export async function announceUpdate(alert, parentName) {
  const payload = toPublicAlert(alert, parentName);
  await emitToUsers(recipients(alert), 'alert:updated', payload);
  if (alert.escalatedAt) await emitToAdmins('alert:updated', payload);
}

export async function escalateAlert(alert, parentName) {
  const escalated = await Alert.findOneAndUpdate(
    { _id: alert.id, status: 'open', escalatedAt: { $exists: false } },
    {
      escalatedAt: new Date(),
      $push: { history: { status: 'escalated', by: 'HOMEX', at: new Date() } },
    },
    { returnDocument: 'after' },
  );
  if (!escalated) return null;

  const payload = toPublicAlert(escalated, parentName);
  await emitToAdmins('alert:new', payload);
  await emitToUsers(recipients(escalated), 'alert:updated', payload);

  const admins = await User.find({ role: 'admin', isActive: true }, '_id');
  await Promise.all(
    admins.map(({ id }) =>
      notify(id, {
        title: `Escalated: ${TITLES[escalated.type]}`,
        body: `${parentName}: ${escalated.message}`,
        link: '/admin/alerts',
      }),
    ),
  );
  return escalated;
}

// Returns the new alert, or null if this exact alert has already been raised.
export async function raiseAlert({ parent, type, message, raisedBy, raisedVia, dedupeKey }) {
  let alert;

  try {
    alert = await Alert.create({
      parentId: parent.id,
      customerId: parent.customerId,
      careManagerId: parent.careManagerId,
      type,
      severity: SEVERITY[type],
      message,
      raisedBy,
      raisedVia,
      dedupeKey,
      history: [{ status: 'open', by: raisedVia, at: new Date() }],
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.dedupeKey) return null;
    throw err;
  }

  // The live event goes first: an emergency should not wait on anything else.
  await emitToUsers(recipients(alert), 'alert:new', toPublicAlert(alert, parent.name));

  const content = { title: TITLES[type], body: `${parent.name}: ${message}` };
  await Promise.all([
    notify(alert.customerId, { ...content, link: '/alerts' }),
    notify(alert.careManagerId, { ...content, link: '/care-manager/alerts' }),
  ]);

  // With no care manager to answer an SOS, it cannot wait out the five minutes.
  if (type === 'sos' && !alert.careManagerId) await escalateAlert(alert, parent.name);
  return alert;
}
