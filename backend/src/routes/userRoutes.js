import { Router } from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticate } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

router.use(authenticate);

router.get('/', requireAdmin, UserController.getAll);
router.get('/:id', UserController.getById);
router.put('/:id', UserController.update);
router.delete('/:id', UserController.delete);

export default router;
