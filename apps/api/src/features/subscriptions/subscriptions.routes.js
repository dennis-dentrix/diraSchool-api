import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  createPaystackCheckout,
  getPaystackStatus,
  paystackWebhook,
  listPayments,
  getSubscriptionPricing,
} from './subscriptions.controller.js';
import { validateCreateCheckout } from './subscriptions.validator.js';

const router = Router();

// Paystack webhook — public, no auth
router.post('/paystack/webhook', paystackWebhook);

router.use(protect, blockIfMustChangePassword);

const canManageSubscription = authorize(
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER
);

const canViewSubscriptionInvoice = authorize(
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER,
  ROLES.SUPERADMIN
);

router.post('/paystack/checkout', canManageSubscription, validateCreateCheckout, createPaystackCheckout);
router.get('/pricing', canManageSubscription, getSubscriptionPricing);
router.get('/paystack/status/:merchantReference', canViewSubscriptionInvoice, getPaystackStatus);
router.get('/payments', canManageSubscription, listPayments);

export default router;
