import { Router } from 'express';
import { createAuthRoutes } from './authRoutes.js';
import { createUserRoutes } from './userRoutes.js';
import { createProjectRoutes } from './projectRoutes.js';
import { createCurrencyRoutes } from './currencyRoutes.js';
import { createAdminRoutes } from './adminRoutes.js';
import { createNotificationRoutes } from './notificationRoutes.js';
import { createPlannerRoutes } from './plannerRoutes.js';
import { createLearningRoutes } from './learningRoutes.js';
import { config } from '../config/index.js';
import { checkDatabaseHealth } from '../database/connect.js';
import { asyncHandler } from '../utils/AppError.js';
import {
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
  authActionRateLimiter,
  aiRateLimiter,
  aiAnonymousRateLimiter,
  documentScanRateLimiter,
  aiRedisQuota,
  aiAnonRedisQuota,
  scanRedisQuota,
} from '../middleware/rateLimiter.js';

import { requireAdmin } from '../middleware/requireAdmin.js';
import { requirePaid } from '../middleware/requirePaid.js';
import { uploadDocument } from '../middleware/upload.js';

export function createApiRouter(container) {
  const { controllers, middleware } = container;
  const router = Router();

  router.get('/health', asyncHandler(async (req, res) => {
    const dbHealthy = await checkDatabaseHealth();
    if (config.isProd) {
      return res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? 'ok' : 'degraded',
      });
    }
    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'ok' : 'degraded',
      message: dbHealthy ? 'Kizumai API opérationnelle' : 'Base de données indisponible',
      environment: config.nodeEnv,
      database: dbHealthy ? 'connected' : 'disconnected',
    });
  }));

  router.use('/auth', createAuthRoutes({
    authController: controllers.authController,
    authenticate: middleware.authenticate,
    loginRateLimiter,
    registerRateLimiter,
    refreshRateLimiter,
    authActionRateLimiter,
  }));
  router.use('/currencies', createCurrencyRoutes({
    currencyController: controllers.currencyController,
  }));
  router.use('/projects', createProjectRoutes({
    projectController: controllers.projectController,
    documentController: controllers.documentController,
    documentScanController: controllers.documentScanController,
    projectStageController: controllers.projectStageController,
    authenticate: middleware.authenticate,
    optionalAuth: middleware.optionalAuth,
    requirePaid,
    aiRateLimiter,
    aiAnonymousRateLimiter,
    documentScanRateLimiter,
    aiRedisQuota,
    aiAnonRedisQuota,
    scanRedisQuota,
    uploadDocument,
  }));
  router.use('/admin', createAdminRoutes({
    adminController: controllers.adminController,
    authenticate: middleware.authenticate,
    requireAdmin,
  }));
  router.use('/notifications', createNotificationRoutes({
    notificationController: controllers.notificationController,
    authenticate: middleware.authenticate,
  }));
  router.use('/planner', createPlannerRoutes({
    plannerController: controllers.plannerController,
    authenticate: middleware.authenticate,
    requirePaid,
  }));
  router.use('/learning-records', createLearningRoutes({
    learningRecordController: controllers.learningRecordController,
    authenticate: middleware.authenticate,
    requirePaid,
  }));
  router.use('/users', createUserRoutes({
    userController: controllers.userController,
    authenticate: middleware.authenticate,
    requireAdmin,
  }));

  return router;
}
