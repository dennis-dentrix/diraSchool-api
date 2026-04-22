import { Router } from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import {
  createBook, listBooks, getBook, updateBook,
  issueLoan, listLoans, getLoan, returnBook, markOverdue,
} from './library.controller.js';
import {
  validateCreateBook, validateUpdateBook, validateListBooks,
  validateIssueLoan, validateReturnBook, validateListLoans,
} from './library.validator.js';
import { ROLES, PLAN_FEATURES } from '../../constants/index.js';

const router = Router();

// ── Feature gate: library module ─────────────────────────────────────────────
// Plan-tier feature gate is active via PLAN_FEATURE_MAP.
router.use(protect, blockIfMustChangePassword, requireFeature(PLAN_FEATURES.LIBRARY));

// Book catalogue — read access to all school staff
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.TEACHER, ROLES.DEPARTMENT_HEAD, ROLES.SECRETARY, ROLES.ACCOUNTANT
);

router.get('/books',      canRead, validateListBooks, listBooks);
router.get('/books/:id',  canRead, getBook);

// Book management — admin only
router.post('/books',        adminOnly, validateCreateBook, createBook);
router.patch('/books/:id',   adminOnly, validateUpdateBook, updateBook);

// Loans — admins + teachers + secretary
const canLoan = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.TEACHER, ROLES.DEPARTMENT_HEAD, ROLES.SECRETARY
);

router.post('/loans',                    canLoan, validateIssueLoan, issueLoan);
router.get('/loans',                     canRead, validateListLoans, listLoans);
router.get('/loans/:id',                 canRead, getLoan);
router.post('/loans/:id/return',         canLoan, validateReturnBook, returnBook);
router.patch('/loans/:id/overdue',       adminOnly, markOverdue);

export default router;
