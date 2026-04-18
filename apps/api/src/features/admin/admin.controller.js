/**
 * Super-admin controllers — platform-wide visibility.
 *
 * All routes here require the `superadminOnly` middleware.
 *
 * Endpoints:
 *   GET  /api/v1/admin/stats                 — platform KPIs
 *   GET  /api/v1/admin/schools               — paginated school list with filters
 *   GET  /api/v1/admin/schools/:id           — single school detail
 *   PATCH /api/v1/admin/schools/:id/status   — update subscription status / plan tier
 */
import School   from '../schools/School.model.js';
import User     from '../users/User.model.js';
import Student  from '../students/Student.model.js';
import AuditLog from '../audit/AuditLog.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { SUBSCRIPTION_STATUSES, PLAN_TIERS, ROLES } from '../../constants/index.js';

// ── GET /api/v1/admin/stats ──────────────────────────────────────────────────

/**
 * Platform-wide KPIs for the super-admin dashboard.
 *
 * Returns:
 *   - schools: total + breakdown by subscriptionStatus
 *   - recentSignups: schools registered in the last 30 days
 *   - users: total + breakdown by role
 *   - topCounties: top-5 counties by school count
 */
export const getStats = asyncHandler(async (req, res) => {
  const now    = new Date();
  const ago30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const [schoolsByStatus, recentSignups, usersByRole, topCounties] = await Promise.all([
    // School counts grouped by subscriptionStatus
    School.aggregate([
      { $group: { _id: '$subscriptionStatus', count: { $sum: 1 } } },
      { $sort:  { count: -1 } },
    ]),

    // Schools registered in the last 30 days
    School.countDocuments({ createdAt: { $gte: ago30d } }),

    // Users grouped by role (exclude superadmins from this count)
    User.aggregate([
      { $match: { role: { $ne: ROLES.SUPERADMIN } } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort:  { count: -1 } },
    ]),

    // Top 5 counties by school count
    School.aggregate([
      { $match:  { county: { $exists: true, $ne: null, $ne: '' } } },
      { $group:  { _id: '$county', count: { $sum: 1 } } },
      { $sort:   { count: -1 } },
      { $limit:  5 },
      { $project: { county: '$_id', count: 1, _id: 0 } },
    ]),
  ]);

  // Flatten schoolsByStatus into an object: { trial: 45, active: 12, ... }
  const statusMap = schoolsByStatus.reduce((acc, { _id, count }) => {
    acc[_id] = count;
    return acc;
  }, {});

  const totalSchools = schoolsByStatus.reduce((sum, { count }) => sum + count, 0);

  return sendSuccess(res, {
    schools: {
      total:        totalSchools,
      byStatus:     statusMap,
      recentSignups,
    },
    users: {
      byRole: usersByRole.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {}),
    },
    topCounties,
  });
});

// ── GET /api/v1/admin/schools ────────────────────────────────────────────────

/**
 * Paginated, filterable list of all schools on the platform.
 *
 * Query params:
 *   status   — filter by subscriptionStatus (trial|active|suspended|expired)
 *   plan     — filter by planTier (trial|starter|growth|professional)
 *   county   — exact match (case-insensitive)
 *   search   — partial match on school name or email
 *   page, limit
 */
export const listSchools = asyncHandler(async (req, res) => {
  const { status, plan, county, search, active } = req.query;

  const filter = {};

  if (active !== undefined) {
    filter.isActive = active !== 'false';
  }

  if (status) {
    if (!Object.values(SUBSCRIPTION_STATUSES).includes(status)) {
      return sendError(res, `Invalid status. Must be one of: ${Object.values(SUBSCRIPTION_STATUSES).join(', ')}`, 400);
    }
    filter.subscriptionStatus = status;
  }

  if (plan) {
    if (!Object.values(PLAN_TIERS).includes(plan)) {
      return sendError(res, `Invalid plan. Must be one of: ${Object.values(PLAN_TIERS).join(', ')}`, 400);
    }
    filter.planTier = plan;
  }

  if (county) {
    filter.county = { $regex: county, $options: 'i' };
  }

  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const total              = await School.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const schools = await School.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Attach staff count to each school
  const schoolIds = schools.map((s) => s._id);
  const staffCounts = await User.aggregate([
    { $match: { schoolId: { $in: schoolIds } } },
    { $group: { _id: '$schoolId', count: { $sum: 1 } } },
  ]);

  const staffMap = staffCounts.reduce((acc, { _id, count }) => {
    acc[_id.toString()] = count;
    return acc;
  }, {});

  // Also attach student counts
  const studentCounts = await Student.aggregate([
    { $match: { schoolId: { $in: schoolIds } } },
    { $group: { _id: '$schoolId', count: { $sum: 1 } } },
  ]);
  const studentMap = studentCounts.reduce((acc, { _id, count }) => {
    acc[_id.toString()] = count;
    return acc;
  }, {});

  const enriched = schools.map((s) => ({
    ...s,
    staffCount:   staffMap[s._id.toString()]   ?? 0,
    studentCount: studentMap[s._id.toString()] ?? 0,
  }));

  return sendSuccess(res, { schools: enriched, meta });
});

// ── GET /api/v1/admin/schools/:id ────────────────────────────────────────────

/**
 * Full detail for a single school, including staff breakdown by role.
 */
export const getSchool = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id).lean();
  if (!school) return sendError(res, 'School not found.', 404);

  // Staff breakdown by role
  const staffByRole = await User.aggregate([
    { $match:  { schoolId: school._id } },
    { $group:  { _id: '$role', count: { $sum: 1 } } },
    { $sort:   { _id: 1 } },
  ]);

  return sendSuccess(res, {
    school: {
      ...school,
      staff: {
        total:  staffByRole.reduce((sum, { count }) => sum + count, 0),
        byRole: staffByRole.reduce((acc, { _id, count }) => {
          acc[_id] = count;
          return acc;
        }, {}),
      },
    },
  });
});

// ── PATCH /api/v1/admin/schools/:id/status ───────────────────────────────────

/**
 * Update a school's subscription status and/or plan tier.
 * Used to manually activate, suspend, or upgrade a school.
 *
 * Body (all optional):
 *   subscriptionStatus — trial | active | suspended | expired
 *   planTier           — trial | starter | growth | professional
 *   isActive           — boolean (hard disable / re-enable)
 */
export const updateSchoolStatus = asyncHandler(async (req, res) => {
  const school = await School.findById(req.params.id);
  if (!school) return sendError(res, 'School not found.', 404);

  const { subscriptionStatus, planTier, isActive } = req.body;

  if (subscriptionStatus !== undefined) {
    if (!Object.values(SUBSCRIPTION_STATUSES).includes(subscriptionStatus)) {
      return sendError(res, `Invalid status. Must be one of: ${Object.values(SUBSCRIPTION_STATUSES).join(', ')}`, 400);
    }
    school.subscriptionStatus = subscriptionStatus;
  }

  if (planTier !== undefined) {
    if (!Object.values(PLAN_TIERS).includes(planTier)) {
      return sendError(res, `Invalid plan tier. Must be one of: ${Object.values(PLAN_TIERS).join(', ')}`, 400);
    }
    school.planTier = planTier;
  }

  if (isActive !== undefined) {
    const wasActive = school.isActive;
    school.isActive = Boolean(isActive);

    // Cascade: deactivating a school immediately blocks all its staff accounts.
    // Re-enabling does NOT bulk-reactivate users (individual pauses are preserved).
    if (!school.isActive && wasActive) {
      await User.updateMany(
        { schoolId: school._id, role: { $ne: 'superadmin' } },
        { isActive: false }
      );
    }
  }

  await school.save();

  return sendSuccess(res, {
    message: 'School updated successfully.',
    school,
  });
});

// ── GET /api/v1/admin/audit-logs ─────────────────────────────────────────────

/**
 * System-wide audit log for the superadmin. Unlike the school-scoped version,
 * this queries all schools and includes the school name for context.
 */
export const listSystemAuditLogs = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.query.schoolId) filter.schoolId = req.query.schoolId;
  if (req.query.resource) filter.resource = req.query.resource;
  if (req.query.action)   filter.action   = req.query.action;

  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
  }

  const total = await AuditLog.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'firstName lastName role')
    .populate('schoolId', 'name');

  return sendSuccess(res, { logs, meta });
});
