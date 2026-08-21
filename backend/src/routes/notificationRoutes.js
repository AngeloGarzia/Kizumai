import { Router } from 'express';

export function createNotificationRoutes({ notificationController, authenticate }) {
  const router = Router();

  router.get('/vapid-public-key', notificationController.getPublicKey);
  router.post('/subscribe', authenticate, notificationController.subscribe);
  router.post('/unsubscribe', authenticate, notificationController.unsubscribe);

  return router;
}
