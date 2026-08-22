import { Router } from 'express';

export function createAdminRoutes({
  adminController,
  authenticate,
  requireAdmin,
  adminRateLimiter,
  adminRedisQuota,
}) {
  const router = Router();
  const noop = (_r, _s, n) => n();
  const adminGate = (req, res, next) =>
    (adminRedisQuota || noop)(req, res, () => adminRateLimiter(req, res, next));

  router.use(authenticate, requireAdmin, adminGate);

  router.get('/settings', adminController.getSettings);
  router.put('/settings', adminController.updateSettings);
  router.post('/settings/test-ai', adminController.testAiEngine);
  router.get('/setup', adminController.getSetup);
  router.put('/app-settings/:key', adminController.upsertAppSetting);
  router.delete('/app-settings/:key', adminController.deleteAppSetting);
  router.get('/prompts', adminController.getPrompts);
  router.put('/prompts/:key', adminController.updatePrompt);
  router.get('/users', adminController.getUsers);
  router.patch('/users/:id/role', adminController.updateUserRole);
  router.get('/connections', adminController.getConnections);
  router.post('/notifications/broadcast', adminController.broadcastNotification);

  return router;
}
