import School from './School.model.js';
import User from '../users/User.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { SUBSCRIPTION_STATUSES, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../../constants/index.js';
import { getRedis } from '../../config/redis.js';
import { logAction } from '../../utils/auditLogger.js';

// Bust the subscription cache for a school after any admin change.
const bustSubCache = async (schoolId) => {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.del(`school:sub:${schoolId}`); } catch { /* non-fatal */ }
};

// ── School-admin endpoints ────────────────────────────────────────────────────

/**
 * GET /api/v1/schools/me
 * Returns the logged-in user's school profile.
 * Any authenticated school user (all roles except superadmin).
 */
export const getMySchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  if (!school) return sendError(res, 'School not found.', 404);
  return sendSuccess(res, { school });
});

/**
 * PATCH /api/v1/schools/me
 * Updates non-sensitive school info (name, phone, county, etc.).
 * Admin roles only — teacher/secretary/parent cannot change school details.
 */
export const updateMySchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.user.schoolId);
  if (!school) return sendError(res, 'School not found.', 404);

  const { name, phone, county, constituency, registrationNumber, address, mpesaTillNumber } = req.body;

  if (name !== undefined) school.name = name;
  if (phone !== undefined) school.phone = phone;
  if (county !== undefined) school.county = county;
  if (constituency !== undefined) school.constituency = constituency;
  if (registrationNumber !== undefined) school.registrationNumber = registrationNumber;
  if (address !== undefined) school.address = address;
  if (mpesaTillNumber !== undefined) school.mpesaTillNumber = mpesaTillNumber || undefined;

  await school.save();
  await bustSubCache(school._id);

  return sendSuccess(res, { school });
});

// ── Superadmin endpoints ──────────────────────────────────────────────────────

/**
 * POST /api/v1/schools
 * Superadmin creates a new school tenant.
 * Default subscription: trial (30 days) — set by the model.
 */
export const createSchool = asyncHandler(async (req, res) => {
  const { name, email, phone, county, constituency, registrationNumber, address } = req.body;

  // Duplicate email check — give a cleaner message than the Mongo 11000 error
  const existing = await School.findOne({ email });
  if (existing) return sendError(res, 'A school with this email already exists.', 409);

  const school = await School.create({
    name,
    email,
    phone,
    county,
    constituency,
    registrationNumber,
    address,
  });

  return sendSuccess(res, { school }, 201);
});

/**
 * GET /api/v1/schools
 * Superadmin lists all school tenants with pagination.
 * Supports ?status= (trial|active|suspended|expired) and ?search= (name/email).
 */
export const listSchools = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.status) {
    filter.subscriptionStatus = req.query.status;
  }

  if (req.query.search) {
    const regex = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { registrationNumber: regex }];
  }

  if (req.query.active !== undefined) {
    filter.isActive = req.query.active !== 'false';
  }

  const total = await School.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const schools = await School.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, { schools, meta });
});

/**
 * GET /api/v1/schools/:id
 * Superadmin retrieves any school by ID.
 */
export const getSchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) return sendError(res, 'School not found.', 404);
  return sendSuccess(res, { school });
});

/**
 * PATCH /api/v1/schools/:id
 * Superadmin updates school info including email and isActive flag.
 * Does NOT change subscriptionStatus — use /subscription for that.
 */
export const updateSchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) return sendError(res, 'School not found.', 404);

  const { name, email, phone, county, constituency, registrationNumber, address, isActive } = req.body;

  // Guard against duplicate email if email is being changed
  if (email && email !== school.email) {
    const duplicate = await School.findOne({ email, _id: { $ne: school._id } });
    if (duplicate) return sendError(res, 'A school with this email already exists.', 409);
  }

  if (name !== undefined) school.name = name;
  if (email !== undefined) school.email = email;
  if (phone !== undefined) school.phone = phone;
  if (county !== undefined) school.county = county;
  if (constituency !== undefined) school.constituency = constituency;
  if (registrationNumber !== undefined) school.registrationNumber = registrationNumber;
  if (address !== undefined) school.address = address;
  if (isActive !== undefined) {
    const wasActive = school.isActive;
    school.isActive = isActive;

    // Cascade: disable all school staff when the school is deactivated.
    // Re-activation intentionally does NOT bulk-reactivate users — an admin
    // may have individually paused some accounts for other reasons.
    if (!isActive && wasActive) {
      await User.updateMany(
        { schoolId: school._id, role: { $ne: 'superadmin' } },
        { isActive: false }
      );
    }
  }

  await school.save();
  await bustSubCache(school._id);

  if (isActive !== undefined) {
    logAction(req, {
      action: isActive ? AUDIT_ACTIONS.ACTIVATE : AUDIT_ACTIONS.SUSPEND,
      resource: AUDIT_RESOURCES.SCHOOL,
      resourceId: school._id,
      meta: { isActive },
    });
  }

  return sendSuccess(res, { school });
});

/**
 * PATCH /api/v1/schools/:id/subscription
 * Superadmin sets the subscription status (trial → active → suspended / expired).
 * Optionally updates the trialExpiry date when extending a trial.
 *
 * Business rules:
 *  - Moving to ACTIVE clears any trial expiry tracking (school is fully subscribed).
 *  - Moving to TRIAL allows passing a new trialExpiry date.
 *  - SUSPENDED / EXPIRED blocks all school users immediately (checked in protect()).
 */
export const updateSubscription = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) return sendError(res, 'School not found.', 404);

  const { subscriptionStatus, planTier, trialExpiry } = req.body;

  school.subscriptionStatus = subscriptionStatus;
  if (planTier !== undefined) school.planTier = planTier;

  if (subscriptionStatus === SUBSCRIPTION_STATUSES.ACTIVE) {
    // Active subscription — trial expiry is no longer relevant
    school.trialExpiry = undefined;
  } else if (
    subscriptionStatus === SUBSCRIPTION_STATUSES.TRIAL &&
    trialExpiry
  ) {
    school.trialExpiry = trialExpiry;
  }

  await school.save();
  await bustSubCache(school._id);

  logAction(req, {
    action: AUDIT_ACTIONS.UPDATE,
    resource: AUDIT_RESOURCES.SCHOOL,
    resourceId: school._id,
    meta: { subscriptionStatus, trialExpiry: trialExpiry || null },
  });

  return sendSuccess(res, {
    message: `School subscription updated to '${subscriptionStatus}'.`,
    school,
  });
});

// ── POST /api/v1/schools/me/sms-sender-id-request ──────────────────────────────

/**
 * School admin endpoint to request a custom SMS sender ID (e.g., NYERI_GIRLS).
 *
 * Body: { senderIdRequested: string }
 * Example: { "senderIdRequested": "NYERI_GIRLS" }
 *
 * Returns: school with updated smsSettings and status 'pending'.
 * Admin will approve/reject after reviewing with Africa's Talking.
 */
export const requestSmsSenderId = asyncHandler(async (req, res) => {
  const { senderIdRequested } = req.body;
  const schoolId = req.user.schoolId;

  if (!senderIdRequested) {
    return sendError(res, 'senderIdRequested is required', 400);
  }

  if (!/^[A-Z0-9_]{1,11}$/.test(senderIdRequested)) {
    return sendError(res, 'Sender ID must be 1-11 alphanumeric chars, e.g., NYERI_GIRLS', 400);
  }

  const school = await School.findByIdAndUpdate(
    schoolId,
    {
      $set: {
        'smsSettings.senderIdRequested': senderIdRequested.toUpperCase(),
        'smsSettings.senderIdStatus': 'pending',
        'smsSettings.requestedAt': new Date(),
      },
    },
    { new: true }
  ).select('name smsSettings');

  logAction(req, {
    action: AUDIT_ACTIONS.UPDATE,
    resource: AUDIT_RESOURCES.SCHOOL,
    resourceId: schoolId,
    meta: { senderIdRequested: senderIdRequested.toUpperCase() },
  });

  return sendSuccess(res, school, 'SMS sender ID requested. Our team will review and approve within 24 hours.');
});
