import { Router } from 'express';
import { getSosLink, resetSosLink } from '../controllers/alertController.js';
import { assignCaregiver, cancelRequest } from '../controllers/assignmentController.js';
import { listCheckIns } from '../controllers/checkinController.js';
import {
  addMedicine,
  listMedicines,
  stopMedicine,
  updateMedicine,
} from '../controllers/medicineController.js';
import {
  createParent,
  deleteParent,
  getParent,
  listParents,
  updateParent,
} from '../controllers/parentController.js';
import { listParentReports } from '../controllers/reportController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  assignCaregiverSchema,
  createParentSchema,
  parentProfileSchema,
} from '../utils/careSchemas.js';
import { checkInQuerySchema, medicineSchema } from '../utils/monitoringSchemas.js';

const router = Router();
const familyAndCaregivers = requireRole('customer', 'caregiver');

router.use(requireAuth);

router.get(
  '/:id/checkins',
  requireRole('customer', 'careManager', 'admin'),
  validateQuery(checkInQuerySchema),
  listCheckIns,
);
router.get('/:id/reports', requireRole('customer', 'careManager', 'admin'), listParentReports);
router.get(
  '/:id/medicines',
  requireRole('customer', 'caregiver', 'careManager', 'admin'),
  listMedicines,
);
router.post('/:id/medicines', familyAndCaregivers, validate(medicineSchema), addMedicine);
router.put(
  '/:id/medicines/:medicineId',
  familyAndCaregivers,
  validate(medicineSchema),
  updateMedicine,
);
router.post('/:id/medicines/:medicineId/stop', familyAndCaregivers, stopMedicine);

router.post(
  '/:id/assign',
  requireRole('customer', 'careManager'),
  validate(assignCaregiverSchema),
  assignCaregiver,
);
router.delete('/:id/assign', requireRole('customer'), cancelRequest);

router.use(requireRole('customer'));
router.get('/:id/sos-link', getSosLink);
router.post('/:id/sos-link', resetSosLink);
router.get('/', listParents);
router.post('/', validate(createParentSchema), createParent);
router.get('/:id', getParent);
router.put('/:id', validate(parentProfileSchema), updateParent);
router.delete('/:id', deleteParent);

export default router;
