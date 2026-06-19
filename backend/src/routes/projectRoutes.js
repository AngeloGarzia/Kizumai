import { Router } from 'express';
import { ProjectController } from '../controllers/ProjectController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/', aiRateLimiter, optionalAuth, ProjectController.create);
router.get('/mine', authenticate, ProjectController.getMine);

export default router;
