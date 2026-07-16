import { Router } from 'express';
import { PlannerController } from '../controllers/PlannerController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePaid } from '../middleware/requirePaid.js';

const router = Router();

router.use(authenticate, requirePaid);

router.get('/events', PlannerController.list);
router.post('/events', PlannerController.create);
router.get('/events/:id', PlannerController.getOne);
router.patch('/events/:id', PlannerController.update);
router.delete('/events/:id', PlannerController.remove);

export default router;
