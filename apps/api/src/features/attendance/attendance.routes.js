import express from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  validateCreateAttendanceRegister,
  validateListAttendanceRegisters,
  validateUpdateAttendanceRegister,
} from './attendance.validator.js';
import {
  createAttendanceRegister,
  listAttendanceRegisters,
  getAttendanceRegister,
  updateAttendanceRegister,
  submitAttendanceRegister,
} from './attendance.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

// Read: all school staff can view attendance
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.DEPARTMENT_HEAD
);

// Write: only admin roles and teachers — secretaries and accountants cannot take/edit attendance
const canWrite = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.TEACHER, ROLES.DEPARTMENT_HEAD
);

router.get('/registers', canRead, validateListAttendanceRegisters, listAttendanceRegisters);
router.post('/registers', canWrite, validateCreateAttendanceRegister, createAttendanceRegister);

router.get('/registers/:id', canRead, getAttendanceRegister);
router.patch('/registers/:id', canWrite, validateUpdateAttendanceRegister, updateAttendanceRegister);

router.post('/registers/:id/submit', canWrite, submitAttendanceRegister);

export default router;
