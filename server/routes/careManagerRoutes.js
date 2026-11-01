import { Router } from 'express';
import { getParentDetail, listFamilies } from '../controllers/careManagerController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('careManager'));
router.get('/families', listFamilies);
router.get('/parents/:id', getParentDetail);

export default router;
