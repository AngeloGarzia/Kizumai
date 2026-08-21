import { Router } from 'express';

export function createAdminRoutes({ adminController, authenticate, requireAdmin }) {
  const router = Router();

  router.use(authenticate, requireAdmin);

  router.get('/settings', adminController.getSettings);
  router.put('/settings', adminController.updateSettings);
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
