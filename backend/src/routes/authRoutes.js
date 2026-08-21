import { Router } from 'express';

export function createAuthRoutes({
  authController,
  authenticate,
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
  authActionRateLimiter,
}) {
  const router = Router();

  router.get('/csrf', authController.csrf);
  router.get('/billing-config', authController.billingConfig);
  router.post('/register', registerRateLimiter, authController.register);
  router.post('/login', loginRateLimiter, authController.login);
  router.post('/refresh', refreshRateLimiter, authController.refresh);
  router.post('/logout', authController.logout);
  router.post('/logout-all', authenticate, authActionRateLimiter, authController.logoutAll);
  router.get('/me', authenticate, authController.me);
  router.post('/upgrade', authenticate, authActionRateLimiter, authController.upgrade);

  return router;
}
