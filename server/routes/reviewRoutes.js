import { Router } from 'express';
import { createReview } from '../controllers/reviewController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reviewSchema } from '../utils/bookingSchemas.js';

const router = Router();

router.post('/', requireAuth, requireRole('customer'), validate(reviewSchema), createReview);

export default router;
