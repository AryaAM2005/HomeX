import { Router } from 'express';
import { createComplaint } from '../controllers/complaintController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createComplaintSchema } from '../utils/adminSchemas.js';

const router = Router();

router.post('/', requireAuth, requireRole('customer'), validate(createComplaintSchema), createComplaint);

export default router;
