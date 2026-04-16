import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import { validateCreateClass, validateUpdateClass, validatePromoteClass } from './classes.validator.js';
import {
  createClass,
  listClasses,
  getClass,
  updateClass,
  deleteClass,
  promoteClass,
  myClass,
} from './classes.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

// Teacher-facing: "My Class" — the class where they are the class teacher
router.get('/my-class', authorize(ROLES.TEACHER), myClass);

// Read access: admins + teachers can see class list (teacher sees their own in practice)
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY, ROLES.TEACHER
);

router.get('/', canRead, listClasses);
router.get('/:id', canRead, getClass);

// Write operations — admin roles only
router.post('/', adminOnly, validateCreateClass, createClass);
router.patch('/:id', adminOnly, validateUpdateClass, updateClass);
router.delete('/:id', adminOnly, deleteClass);
router.post('/:id/promote', adminOnly, validatePromoteClass, promoteClass);

export default router;
