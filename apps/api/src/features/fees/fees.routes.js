import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import {
  validateCreateFeeStructure,
  validateUpdateFeeStructure,
  validateListFeeStructures,
  validateCreatePayment,
  validateReversePayment,
  validateListPayments,
  validateBalanceQuery,
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
  getStudentBalance,
} from './fees.controller.js';

const router = express.Router();

// All fee routes require authentication + admin role
router.use(protect, blockIfMustChangePassword, adminOnly);

// ── Fee Structures ────────────────────────────────────────────────────────────
router
  .route('/structures')
  .get(validateListFeeStructures, listFeeStructures)
  .post(validateCreateFeeStructure, createFeeStructure);

router
  .route('/structures/:id')
  .get(getFeeStructure)
  .patch(validateUpdateFeeStructure, updateFeeStructure)
  .delete(deleteFeeStructure);

// ── Payments ──────────────────────────────────────────────────────────────────
router
  .route('/payments')
  .get(validateListPayments, listPayments)
  .post(validateCreatePayment, createPayment);

router.route('/payments/:id').get(getPayment);

router.post('/payments/:id/reverse', validateReversePayment, reversePayment);

// ── Balance ───────────────────────────────────────────────────────────────────
router.get('/balance', validateBalanceQuery, getStudentBalance);

export default router;
