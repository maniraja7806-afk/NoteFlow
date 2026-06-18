import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/env';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import noteRoutes from './routes/noteRoutes';

export function createApp(): Application {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers.
  app.use(helmet());

  // CORS — restrict to the configured client origin.
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
    })
  );

  // Body parsing with a sane size limit.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Request logging (skip noise in test).
  if (config.nodeEnv !== 'test') {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }

  // Health check.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ success: true, status: 'ok', uptime: process.uptime() });
  });

  // Rate-limited API.
  app.use('/api', apiLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/notes', noteRoutes);

  // 404 + error handling (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
