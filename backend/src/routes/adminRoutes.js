import { Router } from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/settings', AdminController.getSettings);
router.put('/settings', AdminController.updateSettings);
router.get('/prompts', AdminController.getPrompts);
router.put('/prompts/:key', AdminController.updatePrompt);
router.get('/users', AdminController.getUsers);
router.patch('/users/:id/role', AdminController.updateUserRole);
router.get('/connections', AdminController.getConnections);
router.post('/notifications/broadcast', AdminController.broadcastNotification);

export default router;
