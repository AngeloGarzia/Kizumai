import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePaid } from '../middleware/requirePaid.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/preview', aiRateLimiter, ProjectController.preview);
router.post('/', aiRateLimiter, authenticate, requirePaid, ProjectController.create);
router.get('/mine', authenticate, requirePaid, ProjectController.getMine);

export default router;
