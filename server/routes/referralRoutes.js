import { Router } from 'express';
import { getReferrals } from '../controllers/referralController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('customer'), getReferrals);

export default router;
