import express from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { getDashboard, getTeacherDashboard } from './dashboard.controller.js';
import { ROLES } from '../../constants/index.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

router.get('/', getDashboard);
router.get('/teacher', authorize(ROLES.TEACHER, ROLES.DEPARTMENT_HEAD), getTeacherDashboard);

export default router;
