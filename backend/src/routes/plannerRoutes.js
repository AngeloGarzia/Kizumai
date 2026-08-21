import { Router } from 'express';

export function createPlannerRoutes({ plannerController, authenticate, requirePaid }) {
  const router = Router();

  router.use(authenticate, requirePaid);

  router.get('/events', plannerController.list);
  router.post('/events', plannerController.create);
  router.get('/events/:id', plannerController.getOne);
  router.patch('/events/:id', plannerController.update);
  router.delete('/events/:id', plannerController.remove);

  return router;
}
