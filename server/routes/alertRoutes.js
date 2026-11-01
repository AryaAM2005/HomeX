import { Router } from 'express';
import {
  getPublicSosPage,
  listAlerts,
  raisePublicSos,
  raiseUserSos,
  updateAlert,
} from '../controllers/alertController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sosLinkLimiter } from '../middleware/rateLimit.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { alertQuerySchema, sosSchema, updateAlertSchema } from '../utils/monitoringSchemas.js';

const router = Router();

// The parent's SOS page has no login. The secret link is the only key.
router.get('/public/:token', sosLinkLimiter, getPublicSosPage);
router.post('/public/:token/sos', sosLinkLimiter, raisePublicSos);

router.use(requireAuth);
router.post('/sos', requireRole('customer', 'caregiver'), validate(sosSchema), raiseUserSos);
router.get(
  '/',
  requireRole('customer', 'careManager', 'admin'),
  validateQuery(alertQuerySchema),
  listAlerts,
);
router.patch('/:id', requireRole('careManager', 'admin'), validate(updateAlertSchema), updateAlert);

export default router;
