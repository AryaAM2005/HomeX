import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import accountRoutes from './routes/accountRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import authRoutes from './routes/authRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import careManagerRoutes from './routes/careManagerRoutes.js';
import caregiverRoutes from './routes/caregiverRoutes.js';
import checkinRoutes from './routes/checkinRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import liveRoutes from './routes/liveRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import parentRoutes from './routes/parentRoutes.js';
import planRoutes from './routes/planRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import { env, isProduction } from './utils/env.js';

export const app = express();

// Requests pass through Vercel. Without trusting it, every visitor would look like one
// IP and share a single rate limit.
if (isProduction) app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/jobs', jobRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/caregivers', caregiverRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/caremanager', careManagerRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/me', accountRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);
