import { Router } from 'express';
import {
  getQuote,
  listPayments,
  listSubscriptions,
  subscribe,
  updateSubscription,
} from '../controllers/subscriptionController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  quoteSchema,
  subscribeSchema,
  updateSubscriptionSchema,
} from '../utils/subscriptionSchemas.js';

const router = Router();

router.use(requireAuth, requireRole('customer'));
router.get('/', listSubscriptions);
router.get('/payments', listPayments);
router.post('/quote', validate(quoteSchema), getQuote);
router.post('/', validate(subscribeSchema), subscribe);
router.patch('/:id', validate(updateSubscriptionSchema), updateSubscription);

export default router;
