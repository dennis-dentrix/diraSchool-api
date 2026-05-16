import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import { ROLES, PLAN_FEATURES } from '../../constants/index.js';
import { handleInboundSms } from './sms-inbound.controller.js';
import {
  sendSingle,
  broadcastSms,
  sendFeeReminders,
  smsHistory,
  smsDeliveries,
  smsStats,
  listCreditPacks,
  buyCreditPack,
  handleDlr,
  testSendDirect,
} from './sms.controller.js';
import { validateSend, validateBroadcast, validateFeeReminder } from './sms.validator.js';

const router = Router();

// ── Public — SMS provider webhooks (no JWT) ──────────────────────────────────
router.post('/inbound', handleInboundSms);
router.post('/dlr',     handleDlr);       // Delivery report callback from provider

// ── Protected ─────────────────────────────────────────────────────────────────
router.use(protect, blockIfMustChangePassword, requireFeature(PLAN_FEATURES.SMS));

const canSms = authorize(
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER,
  ROLES.SECRETARY,
  ROLES.ACCOUNTANT,
);

router.post('/send',               canSms, validateSend,      sendSingle);
router.post('/broadcast',          canSms, validateBroadcast, broadcastSms);
router.post('/fee-reminders',      canSms, validateFeeReminder, sendFeeReminders);
router.get('/history',             canSms,                    smsHistory);
router.get('/deliveries',          canSms,                    smsDeliveries);
router.get('/stats',               canSms,                    smsStats);
router.get('/credit-packs',        canSms,                    listCreditPacks);
router.post('/credit-packs/checkout', canSms,                 buyCreditPack);
router.post('/test-direct',        canSms,                    testSendDirect);

export default router;
