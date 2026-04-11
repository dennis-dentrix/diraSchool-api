import crypto from 'crypto';
import User from './User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { normalisePhone } from '../../utils/phone.js';

/**
 * POST /api/v1/users
 * Creates a staff user scoped to the logged-in admin's school.
 * The new user must change their password on first login.
 * Admin roles only.
 */
export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, role, password } = req.body;

  const user = await User.create({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.toLowerCase().trim(),
    phone: phone ? normalisePhone(phone) : undefined,
    password,
    role,
    schoolId: req.user.schoolId,
    mustChangePassword: true,
  });

  return sendSuccess(res, { user: user.toSafeObject() }, 201);
});

/**
 * GET /api/v1/users
 * Lists all users in the school. Supports ?role= filter.
 * Admin roles only.
 */
export const listUsers = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.role) filter.role = req.query.role;

  const total = await User.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const users = await User.find(filter)
    .sort({ lastName: 1, firstName: 1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, { users: users.map((u) => u.toSafeObject()), meta });
});

/**
 * GET /api/v1/users/:id
 * Returns a single user. Must belong to the same school.
 * Admin roles only.
 */
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!user) return sendError(res, 'User not found.', 404);

  return sendSuccess(res, { user: user.toSafeObject() });
});

/**
 * PATCH /api/v1/users/:id
 * Updates name, phone, role, or active status of a user in the same school.
 * Admin roles only.
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!user) return sendError(res, 'User not found.', 404);

  // Prevent admins from editing themselves via this endpoint
  if (user._id.equals(req.user._id)) {
    return sendError(res, 'Use /auth/change-password to update your own account.', 400);
  }

  const { firstName, lastName, phone, role, isActive } = req.body;
  if (firstName !== undefined) user.firstName = firstName;
  if (lastName !== undefined) user.lastName = lastName;
  if (phone !== undefined) user.phone = normalisePhone(phone);
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  return sendSuccess(res, { user: user.toSafeObject() });
});

/**
 * POST /api/v1/users/:id/reset-password
 * Admin resets a staff member's password.
 * Generates a random 12-char temporary password, sets mustChangePassword = true.
 * In production the temp password would be sent via SMS/email; here it's returned in the response.
 */
export const resetUserPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!user) return sendError(res, 'User not found.', 404);

  if (user._id.equals(req.user._id)) {
    return sendError(res, 'Use /auth/change-password to reset your own password.', 400);
  }

  // Generate a readable temp password: 4 random uppercase + 4 digits + 4 lowercase
  const tempPassword =
    crypto.randomBytes(2).toString('hex').toUpperCase() +
    String(Math.floor(1000 + Math.random() * 9000)) +
    crypto.randomBytes(2).toString('hex').toLowerCase();

  user.password = tempPassword;
  user.mustChangePassword = true;
  await user.save();

  return sendSuccess(res, {
    message: 'Password reset. User must change password on next login.',
    tempPassword, // surface so admin can communicate it to the user
  });
});
