import { Router } from 'express';
import { deleteMyAccount, downloadMyData } from '../controllers/accountController.js';
import { requireAuth } from '../middleware/auth.js';
import { accountLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { deleteAccountSchema } from '../utils/adminSchemas.js';

const router = Router();

router.use(requireAuth);
router.get('/data', downloadMyData);
router.delete('/data', accountLimiter, validate(deleteAccountSchema), deleteMyAccount);

export default router;
