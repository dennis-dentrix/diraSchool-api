import express from 'express';
import { ADMIN_ROLES, ROLES } from '../../constants/index.js';
import { env } from '../../config/env.js';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { sendForbidden } from '../../utils/response.js';
import {
  allocateUnallocatedPayment,
  confirmationCallback,
  createManualPayment,
  getMpesaSettings,
  getMpesaSummary,
  listMpesaPayments,
  listStudentPayments,
  listUnallocatedPayments,
  registerC2B,
  updateMpesaSettings,
  validationCallback,
} from './mpesa.controller.js';
import {
  validateAllocatePayment,
  validateListMpesaPayments,
  validateListUnallocatedPayments,
  validateManualPayment,
  validateMpesaSettings,
} from './mpesa.validator.js';

const router = express.Router();

const SAFARICOM_IPS = [
  '196.201.214.200',
  '196.201.214.206',
  '196.201.213.114',
  '196.201.214.207',
  '196.201.214.208',
  '196.201.213.44',
  '196.201.212.127',
  '196.201.212.138',
  '196.201.212.129',
  '196.201.212.136',
  '196.201.212.74',
  '196.201.212.69',
];

const allowedCallbackIps = new Set([...SAFARICOM_IPS, ...env.MPESA_ALLOWED_IPS]);

export const validateSafaricomIP = (req, res, next) => {
  const whitelistEnabled =
    env.MPESA_IP_WHITELIST_ENABLED === 'true' ||
    (env.isProduction && env.MPESA_IP_WHITELIST_ENABLED !== 'false');

  if (!whitelistEnabled) return next();

  const forwardedFor = req.headers['x-forwarded-for'];
  const clientIp = (
    Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  )?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '';
  const cleanIp = clientIp.replace('::ffff:', '');

  if (!allowedCallbackIps.has(cleanIp)) {
    return sendForbidden(res, 'Forbidden');
  }

  next();
};

// Safaricom callbacks are public. They cannot use JWT auth; protect them by IP.
router.post('/validation', validateSafaricomIP, validationCallback);
router.post('/confirmation', validateSafaricomIP, confirmationCallback);

router.use(protect, blockIfMustChangePassword);

const canViewPayments = authorize(...ADMIN_ROLES, ROLES.SECRETARY, ROLES.ACCOUNTANT);
const canManagePayments = authorize(...ADMIN_ROLES, ROLES.SECRETARY, ROLES.ACCOUNTANT);
const schoolAdminOnly = authorize(ROLES.SCHOOL_ADMIN);

router
  .route('/settings')
  .get(canViewPayments, getMpesaSettings)
  .put(schoolAdminOnly, validateMpesaSettings, updateMpesaSettings);

router.post('/register-c2b/:schoolId', schoolAdminOnly, registerC2B);

router.post('/payments/manual', canManagePayments, validateManualPayment, createManualPayment);
router.post('/payments/allocate', canManagePayments, validateAllocatePayment, allocateUnallocatedPayment);
router.get('/payments/unallocated', canManagePayments, validateListUnallocatedPayments, listUnallocatedPayments);
router.get('/payments/summary', canViewPayments, getMpesaSummary);
router.get('/payments/student/:studentId', canViewPayments, listStudentPayments);
router.get('/payments', canViewPayments, validateListMpesaPayments, listMpesaPayments);

export default router;
