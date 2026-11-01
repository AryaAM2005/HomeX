import { Router } from 'express';
import { z } from 'zod';
import { getLiveEvents } from '../controllers/liveController.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';

const liveQuerySchema = z.object({ after: z.coerce.date().optional() });

const router = Router();

router.get('/', requireAuth, validateQuery(liveQuerySchema), getLiveEvents);

export default router;
