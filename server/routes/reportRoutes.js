import { Router } from 'express';
import { getReportAttachment } from '../controllers/reportController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:id/attachments/:attachmentId', requireAuth, getReportAttachment);

export default router;
