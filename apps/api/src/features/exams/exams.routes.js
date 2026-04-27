import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  validateCreateExam,
  validateUpdateExam,
  validateListExams,
} from './exams.validator.js';
import {
  createExam,
  listExams,
  getExam,
  updateExam,
  deleteExam,
} from './exams.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

const academicRoles = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER,
  ROLES.TEACHER, ROLES.DEPARTMENT_HEAD
);

router.route('/')
  .get(academicRoles, validateListExams, listExams)
  .post(academicRoles, validateCreateExam, createExam);

router.route('/:id')
  .get(academicRoles, getExam)
  .patch(adminOnly, validateUpdateExam, updateExam)
  .delete(adminOnly, deleteExam);

export default router;
