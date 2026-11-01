import { Router } from 'express';
import {
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { accountLimiter, loginLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../utils/authSchemas.js';

const router = Router();

router.post('/register', accountLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/forgot-password', accountLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', accountLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
