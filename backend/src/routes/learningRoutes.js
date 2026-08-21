import { Router } from 'express';

export function createLearningRoutes({ learningRecordController, authenticate, requirePaid }) {
  const router = Router();

  router.use(authenticate, requirePaid);

  router.get('/', learningRecordController.list);
  router.post('/', learningRecordController.create);
  router.post('/from-ai', learningRecordController.createFromAi);
  router.get('/:id', learningRecordController.getOne);
  router.patch('/:id', learningRecordController.update);
  router.delete('/:id', learningRecordController.remove);

  return router;
}
