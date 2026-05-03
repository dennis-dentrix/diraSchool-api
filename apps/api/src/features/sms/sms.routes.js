import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import { handleInboundSms } from './sms-inbound.controller.js';
import { sendSingle, broadcastSms, smsHistory, testSendDirect } from './sms.controller.js';
import { validateSend, validateBroadcast } from './sms.validator.js';

const router = Router();

// ── Public — Africa's Talking inbound webhook (no JWT) ───────────────────────
router.post('/inbound', handleInboundSms);

// ── Protected ─────────────────────────────────────────────────────────────────
router.use(protect, blockIfMustChangePassword);

// Roles that may send or view SMS: all operational staff except plain teacher
const canSms = authorize(
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER,
  ROLES.SECRETARY,
  ROLES.ACCOUNTANT,
);

router.post('/send',        canSms, validateSend,      sendSingle);
router.post('/broadcast',   canSms, validateBroadcast, broadcastSms);
router.get('/history',      canSms,                    smsHistory);
// Direct AT test — bypasses queue, returns raw AT response for debugging
router.post('/test-direct', canSms,                    testSendDirect);

export default router;
