import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { buildExport, deleteAccount } from '../utils/accountData.js';
import { ApiError } from '../utils/ApiError.js';
import { endSession } from '../utils/session.js';

export async function downloadMyData(req, res) {
  res.attachment('homex-my-data.json');
  res.type('application/json');
  res.send(JSON.stringify(await buildExport(req.user), null, 2));
}

export async function deleteMyAccount(req, res) {
  const user = await User.findById(req.user.id).select('+passwordHash');

  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
    const message = 'That password is not correct';
    throw new ApiError(400, message, { password: message });
  }

  await deleteAccount(user);
  endSession(res);
  res.status(204).end();
}
