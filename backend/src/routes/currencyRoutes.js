import { Router } from 'express';
import { CurrencyController } from '../controllers/CurrencyController.js';

const router = Router();

router.get('/', CurrencyController.list);

export default router;
