import { Alert } from '../models/Alert.js';
import { Parent } from '../models/Parent.js';
import { User } from '../models/User.js';
import { notify } from './notifications.js';

async function leastBusyManager(excludeId) {
  const managers = await User.find({
    role: 'careManager',
    isActive: true,
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  const loads = await Promise.all(
    managers.map(async (manager) => ({
      id: manager.id,
      families: (await Parent.distinct('customerId', { careManagerId: manager.id })).length,
    })),
  );
  return loads.sort((a, b) => a.families - b.families)[0]?.id;
}

// A family keeps one care manager across all its parents. New families go to whoever has the fewest.
export async function chooseCareManager(customerId) {
  const sibling = await Parent.findOne({ customerId, careManagerId: { $exists: true } });
  return sibling?.careManagerId ?? leastBusyManager();
}

// Hands a departing manager's families to the others, so no SOS waits on someone who has left.
export async function redistributeFamilies(managerId) {
  const customerIds = await Parent.distinct('customerId', { careManagerId: managerId });

  for (const customerId of customerIds) {
    const nextManager = await leastBusyManager(managerId);
    const change = nextManager
      ? { careManagerId: nextManager }
      : { $unset: { careManagerId: 1 } };

    await Parent.updateMany({ customerId, careManagerId: managerId }, change);
    await Alert.updateMany(
      { customerId, careManagerId: managerId, status: { $in: ['open', 'acknowledged'] } },
      change,
    );
    await notify(nextManager, {
      title: 'New family assigned',
      body: 'A family has moved to your care.',
      link: '/care-manager',
    });
  }
}
