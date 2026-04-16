import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  validateCreateSubject,
  validateUpdateSubject,
  validateAssignTeachers,
  validateListSubjects,
} from './subjects.validator.js';
import {
  createSubject,
  listSubjects,
  getSubject,
  updateSubject,
  deleteSubject,
  assignTeachers,
  mySubjects,
} from './subjects.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

// Teachers can view their own subjects
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY, ROLES.TEACHER
);

// My subjects — teacher-facing shortcut
router.get('/my-subjects', authorize(ROLES.TEACHER), mySubjects);

// List & detail — teachers included (controller filters by teacherIds for teachers)
router.get('/',    canRead, validateListSubjects, listSubjects);
router.get('/:id', canRead, getSubject);

// Write operations — admin roles only
router.post('/',   adminOnly, validateCreateSubject, createSubject);

router.route('/:id')
  .patch(adminOnly, validateUpdateSubject, updateSubject)
  .delete(adminOnly, deleteSubject);

// Assign teachers + HOD for a subject
router.patch('/:id/teachers', adminOnly, validateAssignTeachers, assignTeachers);

export default router;
