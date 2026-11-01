import { Router } from 'express';
import { listNotifications, markAllRead } from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listNotifications);
router.post('/read-all', markAllRead);

export default router;
