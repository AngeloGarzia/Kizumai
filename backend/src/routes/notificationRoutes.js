import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/vapid-public-key', NotificationController.getPublicKey);
router.post('/subscribe', authenticate, NotificationController.subscribe);
router.post('/unsubscribe', authenticate, NotificationController.unsubscribe);

export default router;
