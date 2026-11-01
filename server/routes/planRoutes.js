import { Router } from 'express';
import { listPlans } from '../controllers/planController.js';

const router = Router();

router.get('/', listPlans);

export default router;
