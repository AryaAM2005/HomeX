import { Router } from 'express';
import { getCheckInPhoto, listTodaysVisits, logCheckIn } from '../controllers/checkinController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseJsonField, uploadOptionalPhoto } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { checkInSchema } from '../utils/monitoringSchemas.js';

const router = Router();

router.use(requireAuth);
router.get('/today', requireRole('caregiver'), listTodaysVisits);
router.post(
  '/',
  requireRole('caregiver'),
  uploadOptionalPhoto,
  parseJsonField('data'),
  validate(checkInSchema),
  logCheckIn,
);
router.get('/:id/photo', getCheckInPhoto);

export default router;
