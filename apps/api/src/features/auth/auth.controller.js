import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import School from '../schools/School.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { env } from '../../config/env.js';
import { ROLES, SUBSCRIPTION_STATUSES, JOB_NAMES, PLAN_TIERS } from '../../constants/index.js';
import { normalisePhone } from '../../utils/phone.js';
import { emailQueue } from '../../jobs/queues.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const signToken = (userId) =>
  jwt.sign({ id: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const attachCookie = (res, token) => {
  const oneDay = 24 * 60 * 60 * 1000;
  res.cookie('token', token, {
    httpOnly: true, // cannot be read by JS
    secure: env.isProduction, // HTTPS only in production
    sameSite: env.isProduction ? 'strict' : 'lax',
    maxAge: oneDay,
  });
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Creates a new school + school_admin user atomically, then sends a
 * verification email. The admin cannot log in until they verify.
 * Public route — no auth required.
 */
export const registerSchool = asyncHandler(async (req, res) => {
  const { schoolName, schoolPhone, county, firstName, lastName, email, phone, password } = req.body;

  // Reject duplicate school email upfront with a clear message
  const existingSchool = await School.findOne({ email: email.toLowerCase().trim() });
  if (existingSchool) {
    return sendError(res, 'A school with this email is already registered.', 409);
  }

  // Generate email verification token before the transaction
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Use a session for atomicity — both School and User must be created or neither
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const [school] = await School.create(
      [
        {
          name: schoolName,
          email: email.toLowerCase().trim(),
          phone: normalisePhone(schoolPhone),
          county,
          subscriptionStatus: SUBSCRIPTION_STATUSES.TRIAL,
          planTier: PLAN_TIERS.TRIAL,
        },
      ],
      { session }
    );

    const [user] = await User.create(
      [
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.toLowerCase().trim(),
          phone: phone ? normalisePhone(phone) : undefined,
          password,
          role: ROLES.SCHOOL_ADMIN,
          schoolId: school._id,
          mustChangePassword: false,
          emailVerified: false,
          emailVerificationToken: tokenHash,
          emailVerificationExpiry: expiry,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    // Enqueue verification email — outside the transaction (non-critical)
    const verifyUrl = `${env.CLIENT_URL}/api/v1/auth/verify-email/${rawToken}`;
    await emailQueue.add(JOB_NAMES.SEND_VERIFICATION_EMAIL, {
      type: JOB_NAMES.SEND_VERIFICATION_EMAIL,
      payload: {
        to: user.email,
        firstName: user.firstName,
        schoolName: school.name,
        verifyUrl,
        expiresInHours: 24,
      },
    });

    // Do NOT set a cookie — user must verify email before logging in
    return sendSuccess(
      res,
      {
        message: `Account created! Please check ${user.email} for a verification link to activate your account.`,
        email: user.email, // surface so the frontend can show "check your inbox at ..."
        school: { _id: school._id, name: school.name },
      },
      201
    );
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
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

  // Block login until email is verified (applies to self-registered school admins)
  if (!user.emailVerified) {
    return sendError(
      res,
      'Please verify your email address before logging in. Check your inbox for the verification link.',
      403
    );
  }

  // Block login until the user accepts their invite and sets a real password
  if (user.invitePending) {
    return sendError(
      res,
      'Your account setup is incomplete. Please check your email for an invitation link.',
      403
    );
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
  user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save({ validateBeforeSave: false });

  // Build the reset link and enqueue the email job (non-blocking)
  const resetUrl = `${env.CLIENT_URL}/api/v1/auth/reset-password/${rawToken}`;

  await emailQueue.add(JOB_NAMES.SEND_RESET_EMAIL, {
    type: JOB_NAMES.SEND_RESET_EMAIL,
    payload: {
      to: user.email,
      firstName: user.firstName,
      resetUrl,
      expiresInHours: 1,
    },
  });

  return sendSuccess(res, {
    message: 'If an account with that email exists, a password reset link has been sent.',
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
    passwordResetToken: hashedToken,
    passwordResetExpiry: { $gt: new Date() }, // not expired
    isActive: true,
  }).select('+passwordResetToken +passwordResetExpiry');

  if (!user) {
    return sendError(res, 'Reset token is invalid or has expired.', 400);
  }

  // Set new password and clear reset fields
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  user.mustChangePassword = false;
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
 * POST /api/v1/auth/accept-invite/:token
 * Validates an account invitation token and sets the user's password.
 * This is how newly created staff accounts are activated.
 *
 * Flow:
 *   1. Admin creates user → invite email sent with token in URL
 *   2. User clicks link → frontend POSTs here with their chosen password
 *   3. Token validated → password set → invitePending cleared → auto-login
 *
 * Public route — no auth required (user has no password yet).
 */
export const acceptInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    inviteToken: hashedToken,
    inviteTokenExpiry: { $gt: new Date() },
    isActive: true,
  }).select('+inviteToken +inviteTokenExpiry');

  if (!user) {
    return sendError(
      res,
      'This invitation link is invalid or has expired. Ask your administrator to resend the invite.',
      400
    );
  }

  // Set the user's chosen password and fully activate the account
  user.password = password;
  user.inviteToken = undefined;
  user.inviteTokenExpiry = undefined;
  user.invitePending = false;
  user.mustChangePassword = false;
  user.emailVerified = true; // admin-created accounts are trusted — no separate email check
  await user.save();

  // Auto-sign the user in immediately
  const jwtToken = signToken(user._id);
  attachCookie(res, jwtToken);

  return sendSuccess(res, {
    message: 'Your account is set up. Welcome!',
    user: user.toSafeObject(),
  });
});

/**
 * GET /api/v1/auth/verify-email/:token
 * Activates a school admin account after they click the verification link.
 * Public route — no auth required (user isn't logged in yet).
 *
 * On success: marks emailVerified=true, auto-logs the user in via cookie.
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: new Date() },
  }).select('+emailVerificationToken +emailVerificationExpiry');

  if (!user) {
    return sendError(
      res,
      'This verification link is invalid or has expired. Request a new one below.',
      400
    );
  }

  // Activate the account
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  // Auto-log the user in — clicking the link is proof of email ownership
  const jwtToken = signToken(user._id);
  attachCookie(res, jwtToken);

  return sendSuccess(res, {
    message: 'Email verified! Welcome to Diraschool.',
    user: user.toSafeObject(),
  });
});

/**
 * POST /api/v1/auth/resend-verification
 * Re-sends the verification email with a fresh 24-hour token.
 * Public route — call this when the original link has expired.
 *
 * Always returns 200 — no user enumeration.
 */
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({
    email: email.toLowerCase().trim(),
    isActive: true,
    emailVerified: false, // already-verified accounts are silently skipped
  }).select('+emailVerificationToken +emailVerificationExpiry');

  // Respond immediately — do not reveal whether the email exists
  if (!user) {
    return sendSuccess(res, {
      message:
        'If an unverified account with that email exists, a new verification link has been sent.',
    });
  }

  // Issue a fresh token
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  user.emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  // Get school name for the email subject
  const school = await School.findById(user.schoolId).select('name').lean();

  const verifyUrl = `${env.CLIENT_URL}/api/v1/auth/verify-email/${rawToken}`;
  await emailQueue.add(JOB_NAMES.SEND_VERIFICATION_EMAIL, {
    type: JOB_NAMES.SEND_VERIFICATION_EMAIL,
    payload: {
      to: user.email,
      firstName: user.firstName,
      schoolName: school?.name ?? 'your school',
      verifyUrl,
      expiresInHours: 24,
    },
  });

  return sendSuccess(res, {
    message:
      'If an unverified account with that email exists, a new verification link has been sent.',
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
