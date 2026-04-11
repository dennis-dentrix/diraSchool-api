import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import { validateCreateClass, validateUpdateClass, validatePromoteClass } from './classes.validator.js';
import { createClass, listClasses, getClass, updateClass, deleteClass, promoteClass } from './classes.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

router.route('/')
  .get(listClasses)
  .post(validateCreateClass, createClass);

router.route('/:id')
  .get(getClass)
  .patch(validateUpdateClass, updateClass)
  .delete(deleteClass);

// End-of-year bulk promotion: moves all active students to the target class
router.post('/:id/promote', validatePromoteClass, promoteClass);

export default router;
