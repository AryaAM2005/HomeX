import { Parent } from '../models/Parent.js';
import { ApiError } from './ApiError.js';

const SCOPE_FOR_ROLE = {
  customer: (user) => ({ customerId: user.id }),
  careManager: (user) => ({ careManagerId: user.id }),
  caregiver: (user) => ({
    $or: [{ primaryCaregiverId: user.id }, { backupCaregiverId: user.id }],
  }),
  admin: () => ({}),
};

// The single rule for who may touch a parent's care records (NFR-3).
export async function findParentFor(user, parentId) {
  const parent = await Parent.findOne({ _id: parentId, ...SCOPE_FOR_ROLE[user.role](user) });
  if (!parent) throw new ApiError(404, 'We could not find that parent');
  return parent;
}
