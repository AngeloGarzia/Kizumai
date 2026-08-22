import { Router } from 'express';

function stackRedis(redisQuota, limiter) {
  const noop = (_r, _s, n) => n();
  return (req, res, next) => (redisQuota || noop)(req, res, () => limiter(req, res, next));
}

export function createAuthRoutes({
  authController,
  authenticate,
  loginRateLimiter,
  registerRateLimiter,
  refreshRateLimiter,
  authActionRateLimiter,
  loginRedisQuota,
  registerRedisQuota,
  refreshRedisQuota,
  authActionRedisQuota,
}) {
  const router = Router();

  router.get('/csrf', authController.csrf);
  router.get('/billing-config', authController.billingConfig);
  router.post('/register', stackRedis(registerRedisQuota, registerRateLimiter), authController.register);
  router.post('/login', stackRedis(loginRedisQuota, loginRateLimiter), authController.login);
  router.post('/refresh', stackRedis(refreshRedisQuota, refreshRateLimiter), authController.refresh);
  router.post('/logout', authController.logout);
  router.post(
    '/logout-all',
    authenticate,
    stackRedis(authActionRedisQuota, authActionRateLimiter),
    authController.logoutAll
  );
  router.get('/me', authenticate, authController.me);
  router.post(
    '/upgrade',
    authenticate,
    stackRedis(authActionRedisQuota, authActionRateLimiter),
    authController.upgrade
  );

  return router;
}
