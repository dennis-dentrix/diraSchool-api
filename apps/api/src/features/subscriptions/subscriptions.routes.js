import { Router } from 'express';
import {
  protect,
  blockIfMustChangePassword,
  authorize,
} from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  createPesapalCheckout,
  getPesapalCheckoutStatus,
  pesapalIpnCallback,
} from './subscriptions.controller.js';
import { validateCreatePesapalCheckout } from './subscriptions.validator.js';

const router = Router();

// Pesapal webhook/IPN callback: public route
router.get('/pesapal/ipn', pesapalIpnCallback);
router.post('/pesapal/ipn', pesapalIpnCallback);

router.use(protect, blockIfMustChangePassword);

const canManageSubscription = authorize(
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER
);

router.post('/pesapal/checkout', canManageSubscription, validateCreatePesapalCheckout, createPesapalCheckout);
router.get('/pesapal/status/:merchantReference', canManageSubscription, getPesapalCheckoutStatus);

export default router;
