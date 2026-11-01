import { Router } from 'express';
import { listMyRequests, respondToRequest } from '../controllers/assignmentController.js';
import { getEarnings } from '../controllers/bookingController.js';
import {
  addMyDocument,
  deleteMyDocument,
  findNearby,
  getCaregiver,
  getCaregiverDocument,
  getCaregiverPhoto,
  getMyProfile,
  submitForReview,
  updateMyProfile,
  uploadMyPhoto,
} from '../controllers/caregiverController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadOneFile } from '../middleware/upload.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  caregiverProfileSchema,
  documentSchema,
  nearbyQuerySchema,
  respondToRequestSchema,
} from '../utils/careSchemas.js';

const router = Router();
const caregiverOnly = requireRole('caregiver');

router.use(requireAuth);

router.get(
  '/nearby',
  requireRole('customer', 'careManager'),
  validateQuery(nearbyQuerySchema),
  findNearby,
);

router.get('/me', caregiverOnly, getMyProfile);
router.put('/me', caregiverOnly, validate(caregiverProfileSchema), updateMyProfile);
router.post('/me/photo', caregiverOnly, uploadOneFile, uploadMyPhoto);
router.post('/me/documents', caregiverOnly, uploadOneFile, validate(documentSchema), addMyDocument);
router.delete('/me/documents/:documentId', caregiverOnly, deleteMyDocument);
router.post('/me/submit', caregiverOnly, submitForReview);
router.get('/me/earnings', caregiverOnly, getEarnings);
router.get('/me/requests', caregiverOnly, listMyRequests);
router.patch(
  '/me/requests/:id',
  caregiverOnly,
  validate(respondToRequestSchema),
  respondToRequest,
);

router.get('/:id', requireRole('customer', 'careManager', 'admin'), getCaregiver);
router.get('/:id/photo', getCaregiverPhoto);
router.get('/:id/documents/:documentId', getCaregiverDocument);

export default router;
