import crypto from 'crypto';
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
 * POST /api/v1/auth/forgot-password
 * Generates a password reset token and (in production) sends it via email/SMS.
 * Public route — no auth required.
 *
 * Security: always returns the same success message whether the email exists or
 * not — prevents user-enumeration attacks.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
  }).select('+passwordResetToken +passwordResetExpiry');

  // Always respond with 200 — don't leak whether the email exists
  if (!user) {
    return sendSuccess(res, {
      message: 'If an account with that email exists, a reset token has been generated.',
    });
  }

  // Generate a cryptographically secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');

  // Store only the hash — raw token is sent to the user
  user.passwordResetToken  = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  // ── TODO: Replace this block with email/SMS delivery in production ──────────
  // When AfricasTalking is active:
  //   await smsQueue.add('send-sms', { phone: user.phone, message: `Reset token: ${rawToken}` });
  // When an email provider (SendGrid / Resend) is added:
  //   await sendResetEmail(user.email, rawToken);
  // ────────────────────────────────────────────────────────────────────────────

  return sendSuccess(res, {
    message: 'Password reset token generated. Use it within 1 hour.',
    // Returned in the response until email/SMS delivery is wired up.
    // Remove this field once a delivery channel is configured.
    resetToken: rawToken,
  });
});

/**
 * POST /api/v1/auth/reset-password/:token
 * Validates the reset token and sets a new password.
 * Public route — no auth required.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  // Hash the incoming token to compare against the stored hash
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken:  hashedToken,
    passwordResetExpiry: { $gt: new Date() }, // not expired
    isActive: true,
  }).select('+passwordResetToken +passwordResetExpiry');

  if (!user) {
    return sendError(res, 'Reset token is invalid or has expired.', 400);
  }

  // Set new password and clear reset fields
  user.password            = password;
  user.passwordResetToken  = undefined;
  user.passwordResetExpiry = undefined;
  user.mustChangePassword  = false;
  await user.save();

  // Sign them in immediately after reset
  const jwtToken = signToken(user._id);
  attachCookie(res, jwtToken);

  return sendSuccess(res, {
    message: 'Password reset successfully. You are now logged in.',
    user: user.toSafeObject(),
  });
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
