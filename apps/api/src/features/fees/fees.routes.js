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
} from './fees.validator.js';
import {
  createFeeStructure,
  listFeeStructures,
  getFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  createPayment,
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
  .all(adminOnly)
  .get(validateListFeeStructures, listFeeStructures)
  .post(validateCreateFeeStructure, createFeeStructure);

router
  .route('/structures/:id')
  .all(adminOnly)
  .get(getFeeStructure)
  .patch(validateUpdateFeeStructure, updateFeeStructure)
  .delete(deleteFeeStructure);

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
