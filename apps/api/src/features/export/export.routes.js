import { Router } from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import { exportStudents, exportPayments, exportStaff } from './export.controller.js';

const router = Router();

// All export endpoints require auth + admin role
router.use(protect, blockIfMustChangePassword, adminOnly);

router.get('/students', exportStudents);
router.get('/payments', exportPayments);
router.get('/staff',    exportStaff);

export default router;
