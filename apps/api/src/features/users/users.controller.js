import User from './User.model.js';
import School from '../schools/School.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { normalisePhone } from '../../utils/phone.js';
import { emailQueue } from '../../jobs/queues.js';
import { JOB_NAMES } from '../../constants/index.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a human-readable temporary password.
 * Format: XXXX-XXXX-XXXX (uppercase alphanum, no ambiguous chars like 0/O/1/I).
 */
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part  = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${part(4)}-${part(4)}-${part(4)}`;
};

/**
 * Issue a temporary password, save it on the user document, and
 * enqueue the email that delivers it to the new staff member.
 *
 * @param {object} user       Mongoose User document (will be mutated + saved)
 * @param {string} schoolName Display name for the email subject
 */
const issueTempPassword = async (user, schoolName) => {
  const tempPassword = generateTempPassword();

  user.password           = tempPassword; // pre-save hook hashes it
  user.mustChangePassword = true;
  user.invitePending      = false;
  await user.save();

  await emailQueue.add(JOB_NAMES.SEND_TEMP_PASSWORD_EMAIL, {
    type: JOB_NAMES.SEND_TEMP_PASSWORD_EMAIL,
    payload: {
      to:           user.email,
      firstName:    user.firstName,
      schoolName,
      tempPassword, // plaintext — shown once in the email, never stored
    },
  });
};

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/v1/users
 * Creates a staff user scoped to the logged-in admin's school.
 *
 * A temporary password is generated and emailed to the new user.
 * They must change it on first login (mustChangePassword = true).
 */
export const createUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, email, phone, role, staffId, tscNumber } = req.body;

  const school = await School.findById(req.user.schoolId).select('name').lean();
  const schoolName = school?.name ?? 'your school';

  // Create with a placeholder — issueTempPassword overwrites it before the email goes out
  const user = await User.create({
    firstName: firstName.trim(),
    lastName:  lastName.trim(),
    email:     email.toLowerCase().trim(),
    phone:     phone ? normalisePhone(phone) : undefined,
    password:  'placeholder', // replaced immediately below
    role,
    staffId:   staffId ?? undefined,
    tscNumber: tscNumber ?? undefined,
    schoolId:  req.user.schoolId,
    mustChangePassword: true,
    invitePending:      false,
    emailVerified:      true, // admin-created accounts are within a verified school
  });

  await issueTempPassword(user, schoolName);

  return sendSuccess(
    res,
    {
      user: user.toSafeObject(),
      message: `Account created. A temporary password has been sent to ${user.email}.`,
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
 * Issues a fresh temporary password and re-sends the credentials email.
 * Use when a staff member hasn't logged in yet or has been locked out.
 */
export const resendInvite = asyncHandler(async (req, res) => {
  const user = await User.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!user) return sendError(res, 'User not found.', 404);

  if (user._id.equals(req.user._id)) {
    return sendError(res, 'Use /auth/forgot-password to reset your own password.', 400);
  }

  const school = await School.findById(req.user.schoolId).select('name').lean();
  const schoolName = school?.name ?? 'your school';

  await issueTempPassword(user, schoolName);

  return sendSuccess(res, {
    message: `A new temporary password has been sent to ${user.email}.`,
  });
});
