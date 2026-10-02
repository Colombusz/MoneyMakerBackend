import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import './config/env';

const app: Application = express();

// Trust Render's proxy (required for rate-limiting & X-Forwarded-For)
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

import authRoutes from './routes/authRoutes';
import accountRoutes from './routes/accountRoutes';
import categoryRoutes from './routes/categoryRoutes';
import transactionRoutes from './routes/transactionRoutes';
import recurringRoutes from './routes/recurringRoutes';
import goalRoutes from './routes/goalRoutes';
import partnerRoutes from './routes/partnerRoutes';
import uploadRoutes from './routes/uploadRoutes';
import syncRoutes from './routes/syncRoutes';
import dayNoteRoutes from './routes/dayNoteRoutes';

import { requestLogger } from './middleware/requestLogger';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

const app: Application = express();

// Security and utility middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/partners', partnerRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/day-notes', dayNoteRoutes);
app.use('/api/sync', syncRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Central error handler
app.use(errorHandler);

export default app;
