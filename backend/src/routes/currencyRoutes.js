import { Router } from 'express';

export function createCurrencyRoutes({ currencyController }) {
  const router = Router();

  router.get('/', currencyController.list);

  return router;
}
