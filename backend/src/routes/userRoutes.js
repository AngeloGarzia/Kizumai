import { Router } from 'express';

export function createUserRoutes({ userController, authenticate, requireAdmin }) {
  const router = Router();

  router.use(authenticate);

  router.get('/', requireAdmin, userController.getAll);
  router.get('/:id', userController.getById);
  router.put('/:id', userController.update);
  router.delete('/:id', requireAdmin, userController.delete);

  return router;
}
