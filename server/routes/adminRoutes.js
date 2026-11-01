import { Router } from 'express';
import {
  createCareManager,
  createEmployerCode,
  getCaregiverForReview,
  getStats,
  listAllBookings,
  listAllPlans,
  listCareManagers,
  listCaregivers,
  listEmployerCodes,
  listUsers,
  updateEmployerCode,
  updatePlan,
  updateUser,
  verifyCaregiver,
} from '../controllers/adminController.js';
import { listComplaints, resolveComplaint } from '../controllers/complaintController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  adminBookingQuerySchema,
  complaintQuerySchema,
  createCareManagerSchema,
  resolveComplaintSchema,
  updateUserSchema,
  userQuerySchema,
} from '../utils/adminSchemas.js';
import { adminCaregiverQuerySchema, verifyCaregiverSchema } from '../utils/careSchemas.js';
import {
  createEmployerCodeSchema,
  updateEmployerCodeSchema,
  updatePlanSchema,
} from '../utils/subscriptionSchemas.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));
router.get('/stats', getStats);
router.get('/users', validateQuery(userQuerySchema), listUsers);
router.patch('/users/:id', validate(updateUserSchema), updateUser);
router.get('/care-managers', listCareManagers);
router.post('/care-managers', validate(createCareManagerSchema), createCareManager);
router.get('/bookings', validateQuery(adminBookingQuerySchema), listAllBookings);
router.get('/complaints', validateQuery(complaintQuerySchema), listComplaints);
router.patch('/complaints/:id', validate(resolveComplaintSchema), resolveComplaint);
router.get('/caregivers', validateQuery(adminCaregiverQuerySchema), listCaregivers);
router.get('/caregivers/:id', getCaregiverForReview);
router.patch('/caregivers/:id', validate(verifyCaregiverSchema), verifyCaregiver);
router.get('/plans', listAllPlans);
router.patch('/plans/:id', validate(updatePlanSchema), updatePlan);
router.get('/employer-codes', listEmployerCodes);
router.post('/employer-codes', validate(createEmployerCodeSchema), createEmployerCode);
router.patch('/employer-codes/:id', validate(updateEmployerCodeSchema), updateEmployerCode);

export default router;
