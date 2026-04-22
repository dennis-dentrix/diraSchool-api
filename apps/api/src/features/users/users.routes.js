import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import { validateCreateUser, validateUpdateUser } from './users.validator.js';
import { createUser, listUsers, getUser, updateUser, resendInvite, adminResetPassword, deleteUser } from './users.controller.js';

const router = express.Router();

// All user management routes require authentication + admin role
router.use(protect, blockIfMustChangePassword, adminOnly);

router.route('/')
  .get(listUsers)
  .post(validateCreateUser, createUser);

router.route('/:id')
  .get(getUser)
  .patch(validateUpdateUser, updateUser)
  .delete(deleteUser);

router.post('/:id/resend-invite', resendInvite);
router.post('/:id/reset-password', adminResetPassword);

export default router;
