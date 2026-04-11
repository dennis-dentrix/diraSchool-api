import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import School from '../schools/School.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { ROLES, SUBSCRIPTION_STATUSES } from '../../constants/index.js';
import { normalisePhone } from '../../utils/phone.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const signToken = (userId) =>
  jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const attachCookie = (res, token) => {
  const oneDay = 24 * 60 * 60 * 1000;
  res.cookie('token', token, {
    httpOnly: true,                           // cannot be read by JS
    secure: env.isProduction,                 // HTTPS only in production
    sameSite: env.isProduction ? 'strict' : 'lax',
    maxAge: oneDay,
  });
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new school + school_admin user atomically.
 * Public route — no auth required.
 */
export const registerSchool = asyncHandler(async (req, res) => {
  const { schoolName, schoolEmail, schoolPhone, county, firstName, lastName, email, phone, password } =
    req.body;

  // Reject duplicate school email upfront with a clear message
  const existingSchool = await School.findOne({ email: schoolEmail.toLowerCase().trim() });
  if (existingSchool) {
    return sendError(res, 'A school with this email is already registered.', 409);
  }

  // Use a session for atomicity — both School and User must be created or neither
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create School
    const [school] = await School.create(
      [
        {
          name: schoolName,
          email: schoolEmail.toLowerCase().trim(),
          phone: normalisePhone(schoolPhone),
          county,
          subscriptionStatus: SUBSCRIPTION_STATUSES.TRIAL,
        },
      ],
      { session }
    );

    // Create the school_admin user
    const [user] = await User.create(
      [
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          phone: normalisePhone(phone),
          password,
          role: ROLES.SCHOOL_ADMIN,
          schoolId: school._id,
          mustChangePassword: false, // They set their own password on registration
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const token = signToken(user._id);
    attachCookie(res, token);

    return sendSuccess(
      res,
      {
        user: user.toSafeObject(),
        school: { _id: school._id, name: school.name, subscriptionStatus: school.subscriptionStatus },
      },
      201
    );
  } catch (err) {
    // Only abort if the transaction hasn't already been committed
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    await session.endSession();
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticates user and sets JWT cookie.
 * Public route — no auth required.
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Explicitly select password (it's excluded by default)
  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
  }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return sendError(res, 'Invalid email or password.', 401);
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  const token = signToken(user._id);
  attachCookie(res, token);

  return sendSuccess(res, {
    user: user.toSafeObject(),
    mustChangePassword: user.mustChangePassword,
  });
});

/**
 * POST /api/v1/auth/logout
 * Clears the JWT cookie.
 * Protected route.
 */
export const logout = asyncHandler(async (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0),
  });
  return sendSuccess(res, { message: 'Logged out successfully.' });
});

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user.
 * Protected route.
 */
export const getMe = asyncHandler(async (req, res) => {
  // req.user is already loaded by the protect middleware
  return sendSuccess(res, { user: req.user });
});

/**
 * POST /api/v1/auth/change-password
 * Changes the user's password and clears mustChangePassword.
 * Protected route — accessible even when mustChangePassword is true.
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return sendError(res, 'Current password is incorrect.', 401);
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();

  return sendSuccess(res, { message: 'Password changed successfully.' });
});
