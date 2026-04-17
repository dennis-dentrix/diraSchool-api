import express from 'express';
import { protect, blockIfMustChangePassword } from '../../middleware/auth.js';
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

router
  .route('/registers')
  .get(validateListAttendanceRegisters, listAttendanceRegisters)
  .post(validateCreateAttendanceRegister, createAttendanceRegister);

router
  .route('/registers/:id')
  .get(getAttendanceRegister)
  .patch(validateUpdateAttendanceRegister, updateAttendanceRegister);

router.post('/registers/:id/submit', submitAttendanceRegister);

export default router;
