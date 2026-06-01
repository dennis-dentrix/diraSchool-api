import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import { ROLES, ROLE_GROUPS } from '../../constants/index.js';
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
router.get('/my-class', authorize(ROLES.TEACHER, ROLES.DEPARTMENT_HEAD), myClass);

// Teachers use GET /classes/my-class — they must not browse the full class list.
router.get('/', authorize(...ROLE_GROUPS.ADMIN), listClasses);
router.get('/:id', authorize(...ROLE_GROUPS.ADMIN), getClass);

// Write operations — admin roles only
router.post('/', adminOnly, validateCreateClass, createClass);
router.patch('/:id', adminOnly, validateUpdateClass, updateClass);
router.delete('/:id', adminOnly, deleteClass);
router.post('/:id/promote', authorize(...ROLE_GROUPS.FINANCE), validatePromoteClass, promoteClass);

export default router;
