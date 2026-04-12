import crypto from 'crypto';
import User from './User.model.js';
import School from '../schools/School.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { normalisePhone } from '../../utils/phone.js';
import { emailQueue } from '../../jobs/queues.js';
import { JOB_NAMES } from '../../constants/index.js';
import { env } from '../../config/env.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a secure invite token, store its hash on the user document,
 * and enqueue the invitation email.
 *
 * @param {object} user       Mongoose User document (will be mutated + saved)
 * @param {string} schoolName Display name for the email subject
 * @param {number} [expiresInDays=7]
 */
const issueInviteToken = async (user, schoolName, expiresInDays = 7) => {
  const rawToken  = crypto.randomBytes(32).toString('hex');
  const hash      = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  user.inviteToken       = hash;
  user.inviteTokenExpiry = expiresAt;
  user.invitePending     = true;
  await user.save({ validateBeforeSave: false });

  // Build the deep-link the user clicks to set their password.
  // The frontend /accept-invite page reads the ?token= query param
  // and calls POST /api/v1/auth/accept-invite/:token.
  const inviteUrl = `${env.CLIENT_URL}/accept-invite?token=${rawToken}`;

  await emailQueue.add(JOB_NAMES.SEND_INVITE_EMAIL, {
    type: JOB_NAMES.SEND_INVITE_EMAIL,
    payload: {
      to:            user.email,
      firstName:     user.firstName,
      schoolName,
      inviteUrl,
      expiresInDays,
    },
  });

  return rawToken; // returned only so tests can consume it; never expose in API response
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/users
 * Creates a staff user scoped to the logged-in admin's school.
 *
 * No password is supplied by the admin — a secure invite email is sent to the
 * new user who sets their own password via the /accept-invite flow.
 * The account is locked (invitePending=true) until the invite is accepted.
 */
export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, role, staffId, tscNumber } = req.body;

  // Temporarily set a random unusable password so the schema required constraint
  // is satisfied. It is replaced when the user accepts their invite.
  const unusablePassword = crypto.randomBytes(32).toString('hex');

  const user = await User.create({
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    email:     email.toLowerCase().trim(),
    phone:     phone ? normalisePhone(phone) : undefined,
    password:  unusablePassword,
    role,
    staffId:   staffId ?? undefined,
    tscNumber: tscNumber ?? undefined,
    schoolId:  req.user.schoolId,
    mustChangePassword: false, // invite flow handles first-login, not this flag
    invitePending: true,
  });

  // Fetch school name for the invite email
  const school = await School.findById(req.user.schoolId).select('name').lean();
  const schoolName = school?.name ?? 'your school';

  await issueInviteToken(user, schoolName);

  return sendSuccess(
    res,
    {
      user: user.toSafeObject(),
      message: `Invitation email sent to ${user.email}. They must accept it before they can log in.`,
    },
    201
  );
});

/**
 * GET /api/v1/users
 * Lists all users in the school. Supports ?role= filter.
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
 */
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) return sendError(res, 'User not found.', 404);
  return sendSuccess(res, { user: user.toSafeObject() });
});

/**
 * PATCH /api/v1/users/:id
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) return sendError(res, 'User not found.', 404);

  if (user._id.equals(req.user._id)) {
    return sendError(res, 'Use /auth/change-password to update your own account.', 400);
  }

  const { firstName, lastName, phone, role, isActive, staffId, tscNumber } = req.body;
  if (firstName  !== undefined) user.firstName  = firstName;
  if (lastName   !== undefined) user.lastName   = lastName;
  if (phone      !== undefined) user.phone      = normalisePhone(phone);
  if (role       !== undefined) user.role       = role;
  if (isActive   !== undefined) user.isActive   = isActive;
  if (staffId    !== undefined) user.staffId    = staffId;
  if (tscNumber  !== undefined) user.tscNumber  = tscNumber;

  await user.save();
  return sendSuccess(res, { user: user.toSafeObject() });
});

/**
 * POST /api/v1/users/:id/resend-invite
 * Admin re-sends the invitation email (or sends a new one if the original expired).
 * Works for both pending invites and active users who need a password reset link.
 */
export const resendInvite = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) return sendError(res, 'User not found.', 404);

  if (user._id.equals(req.user._id)) {
    return sendError(res, 'Use /auth/forgot-password to reset your own password.', 400);
  }

  const school = await School.findById(req.user.schoolId).select('name').lean();
  const schoolName = school?.name ?? 'your school';

  await issueInviteToken(user, schoolName);

  return sendSuccess(res, {
    message: `Invitation email re-sent to ${user.email}.`,
  });
});
