import { Router } from 'express';
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import projectRoutes from './projectRoutes.js';
import currencyRoutes from './currencyRoutes.js';
import adminRoutes from './adminRoutes.js';
import { config } from '../config/index.js';
import { checkDatabaseHealth } from '../database/connect.js';
import { asyncHandler } from '../utils/AppError.js';

const router = Router();

router.get('/health', asyncHandler(async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    message: dbHealthy ? 'Myrokai API opérationnelle' : 'Base de données indisponible',
    environment: config.nodeEnv,
    database: dbHealthy ? 'connected' : 'disconnected',
  });
}));

router.use('/auth', authRoutes);
router.use('/currencies', currencyRoutes);
router.use('/projects', projectRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);

export default router;
