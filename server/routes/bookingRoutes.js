import { Router } from 'express';
import {
  changeBookingStatus,
  createBooking,
  getBookingQuote,
  listBookings,
} from '../controllers/bookingController.js';
import { submitCareReport } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { parseJsonField, uploadAttachments } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import {
  bookingActionSchema,
  bookingQuoteSchema,
  careReportSchema,
  createBookingSchema,
} from '../utils/bookingSchemas.js';

const router = Router();

router.use(requireAuth);
router.get('/', requireRole('customer', 'caregiver'), listBookings);
router.post('/quote', requireRole('customer'), validate(bookingQuoteSchema), getBookingQuote);
router.post('/', requireRole('customer'), validate(createBookingSchema), createBooking);
router.patch(
  '/:id/status',
  requireRole('customer', 'caregiver'),
  validate(bookingActionSchema),
  changeBookingStatus,
);
router.post(
  '/:id/report',
  requireRole('caregiver'),
  uploadAttachments,
  parseJsonField('data'),
  validate(careReportSchema),
  submitCareReport,
);

export default router;
