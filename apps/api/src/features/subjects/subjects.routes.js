import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import {
  validateCreateSubject,
  validateUpdateSubject,
  validateListSubjects,
} from './subjects.validator.js';
import {
  createSubject,
  listSubjects,
  getSubject,
  updateSubject,
  deleteSubject,
  assignTeacher,
} from './subjects.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

router.route('/')
  .get(validateListSubjects, listSubjects)
  .post(validateCreateSubject, createSubject);

router.route('/:id')
  .get(getSubject)
  .patch(validateUpdateSubject, updateSubject)
  .delete(deleteSubject);

// Assign or unassign the teacher for a subject
// Body: { teacherId: "<id>" } or { teacherId: null } to unassign
router.patch('/:id/teacher', assignTeacher);

export default router;
