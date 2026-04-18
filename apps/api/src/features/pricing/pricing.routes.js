import { Router } from 'express';
import { calculatePrice } from './pricing.controller.js';

const router = Router();

// Public — no auth required. Used by the pricing page and billing page calculator.
router.get('/calculate', calculatePrice);

export default router;
