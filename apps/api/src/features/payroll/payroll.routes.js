import { Router } from 'express';
import { protect, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  listSalaryGrades, createSalaryGrade, updateSalaryGrade, deleteSalaryGrade,
  listPayrollRuns, getPayrollRun, generatePayrollRun,
  approvePayrollRun, markPayrollPaid, deletePayrollRun,
} from './payroll.controller.js';

const router = Router();

const PAYROLL_ROLES = [ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER, ROLES.ACCOUNTANT];
const APPROVE_ROLES = [ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER];

router.use(protect);
router.use(authorize(...PAYROLL_ROLES));

// ── Salary grades ──────────────────────────────────────────────────────────────
router.get('/grades',         listSalaryGrades);
router.post('/grades',        createSalaryGrade);
router.patch('/grades/:id',   updateSalaryGrade);
router.delete('/grades/:id',  deleteSalaryGrade);

// ── Payroll runs ───────────────────────────────────────────────────────────────
router.get('/runs',                       listPayrollRuns);
router.get('/runs/:id',                   getPayrollRun);
router.post('/runs',                      generatePayrollRun);
router.delete('/runs/:id',                deletePayrollRun);
router.post('/runs/:id/approve',  authorize(...APPROVE_ROLES), approvePayrollRun);
router.post('/runs/:id/paid',     authorize(...APPROVE_ROLES), markPayrollPaid);

export default router;
