import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
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

router.use(protect, blockIfMustChangePassword, adminOnly);

router.route('/')
  .get(validateListExams, listExams)
  .post(validateCreateExam, createExam);

router.route('/:id')
  .get(getExam)
  .patch(validateUpdateExam, updateExam)
  .delete(deleteExam);

export default router;
