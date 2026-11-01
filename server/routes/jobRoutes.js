import { Router } from 'express';
import { tickJobs } from '../controllers/jobController.js';

const router = Router();

router.get('/tick', tickJobs);

export default router;
