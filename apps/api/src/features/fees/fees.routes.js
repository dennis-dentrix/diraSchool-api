import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import { ADMIN_ROLES, ROLES } from '../../constants/index.js';
import {
  validateCreateFeeStructure,
  validateUpdateFeeStructure,
  validateListFeeStructures,
  validateCreatePayment,
  validateReversePayment,
  validateListPayments,
  validateBalanceQuery,
  validateFinanceDashboardSummaryQuery,
  validateAdaptFeeStructures,
} from './fees.validator.js';
import {
  createFeeStructure,
  listFeeStructures,
  getFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  createPayment,
  adaptFeeStructures,
  listPayments,
  getPayment,
  reversePayment,
  issueReceipt,
  getStudentBalance,
  getFinanceDashboardSummary,
} from './fees.controller.js';

const router = express.Router();

// All fee routes require authentication
router.use(protect, blockIfMustChangePassword);

const canManageFees = authorize(...ADMIN_ROLES, ROLES.SECRETARY, ROLES.ACCOUNTANT);
const canIssueReceipts = authorize(ROLES.SECRETARY, ROLES.ACCOUNTANT);

// ── Fee Structures ────────────────────────────────────────────────────────────
router
  .route('/structures')
  .get(canManageFees, validateListFeeStructures, listFeeStructures)
  .post(adminOnly, validateCreateFeeStructure, createFeeStructure);

router.post('/structures/adapt', adminOnly, validateAdaptFeeStructures, adaptFeeStructures);

router
  .route('/structures/:id')
  .get(canManageFees, getFeeStructure)
  .patch(adminOnly, validateUpdateFeeStructure, updateFeeStructure)
  .delete(adminOnly, deleteFeeStructure);

// ── Payments ──────────────────────────────────────────────────────────────────
router
  .route('/payments')
  .all(canManageFees)
  .get(validateListPayments, listPayments)
  .post(validateCreatePayment, createPayment);

router.route('/payments/:id').all(canManageFees).get(getPayment);

router.post('/payments/:id/reverse', canManageFees, validateReversePayment, reversePayment);
router.post('/payments/:id/issue-receipt', canIssueReceipts, issueReceipt);
router.get('/dashboard-summary', canManageFees, validateFinanceDashboardSummaryQuery, getFinanceDashboardSummary);

// ── Balance ───────────────────────────────────────────────────────────────────
router.get('/balance', canManageFees, validateBalanceQuery, getStudentBalance);

export default router;
