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
 *   GET  /api/v1/admin/users                 — platform-wide user list
 *   PATCH /api/v1/admin/users/:id/toggle     — toggle user isActive
 */
import School      from '../schools/School.model.js';
import SchoolGroup from './SchoolGroup.model.js';
import User        from '../users/User.model.js';
import Student     from '../students/Student.model.js';
import AuditLog    from '../audit/AuditLog.model.js';
import SmsDelivery from '../sms/SmsDelivery.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { SUBSCRIPTION_STATUSES, PLAN_TIERS, ROLES, SMS_DELIVERY_STATUS } from '../../constants/index.js';
import { env } from '../../config/env.js';
import { captureError, sentryEnabled } from '../../config/sentry.js';
import { sendSenderIdReviewedEmail } from '../../services/email.service.js';
import { getCurrentTermAndYear } from '../../utils/term.js';

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
      { $match:  { county: { $exists: true, $nin: [null, ''] } } },
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

// ── GET /api/v1/admin/users ───────────────────────────────────────────────────

/**
 * Platform-wide user list for the superadmin.
 * Unlike /api/v1/users, this is NOT scoped to a single school.
 *
 * Query params:
 *   search   — partial match on firstName, lastName, email
 *   role     — filter by role
 *   schoolId — filter by school
 *   isActive — 'true' | 'false'
 *   page, limit
 */
export const listAdminUsers = asyncHandler(async (req, res) => {
  const { search, role, schoolId, isActive } = req.query;

  const filter = { role: { $ne: ROLES.SUPERADMIN } };

  if (role)     filter.role     = role;
  if (schoolId) filter.schoolId = schoolId;

  if (isActive !== undefined) {
    filter.isActive = isActive !== 'false';
  }

  if (search) {
    const r = new RegExp(search.trim(), 'i');
    filter.$or = [{ firstName: r }, { lastName: r }, { email: r }];
  }

  const total = await User.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const users = await User.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('schoolId', 'name county subscriptionStatus')
    .lean();

  return sendSuccess(res, { users, meta });
});

// ── PATCH /api/v1/admin/users/:id/toggle ─────────────────────────────────────

/**
 * Toggle a user's isActive flag.
 * Superadmin cannot be toggled via this endpoint.
 */
export const toggleAdminUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return sendError(res, 'User not found.', 404);
  if (user.role === ROLES.SUPERADMIN) {
    return sendError(res, 'Cannot modify a superadmin account.', 403);
  }

  user.isActive = !user.isActive;
  await user.save();

  return sendSuccess(res, {
    message: `User ${user.isActive ? 'activated' : 'deactivated'}.`,
    user: { _id: user._id, isActive: user.isActive },
  });
});

// ── POST /api/v1/admin/monitoring-test ──────────────────────────────────────
/**
 * Emits a synthetic Sentry error event for verification.
 *
 * Safety:
 * - Superadmin-only route (via router middleware)
 * - Blocked in production unless SENTRY_ALLOW_PROD_TEST_ENDPOINT=true
 */
export const triggerMonitoringTest = asyncHandler(async (req, res) => {
  if (env.isProduction && process.env.SENTRY_ALLOW_PROD_TEST_ENDPOINT !== 'true') {
    return sendError(
      res,
      'Monitoring test endpoint is disabled in production. Set SENTRY_ALLOW_PROD_TEST_ENDPOINT=true to allow it temporarily.',
      403
    );
  }

  if (!sentryEnabled) {
    return sendError(res, 'Sentry is not configured on this environment.', 400);
  }

  const testError = new Error('Synthetic monitoring test event (manual trigger)');
  const eventId = captureError(testError, {
    monitoringTest: {
      triggeredByUserId: req.user?._id?.toString(),
      triggeredAt: new Date().toISOString(),
      route: '/api/v1/admin/monitoring-test',
      environment: env.NODE_ENV,
    },
  });

  return sendSuccess(res, {
    message: 'Sentry test event sent.',
    eventId,
  });
});

// ── PATCH /api/v1/admin/schools/:id/sms-sender-id ──────────────────────────────

/**
 * Admin endpoint to approve or reject a school's requested SMS sender ID.
 *
 * Body:
 * {
 *   action: 'approve' | 'reject',
 *   senderIdApproved?: string  (required if action='approve')
 *   rejectionReason?: string   (optional if action='reject')
 * }
 *
 * Example:
 *   PATCH /api/v1/admin/schools/60d5ec49c1234/sms-sender-id
 *   { "action": "approve", "senderIdApproved": "NYERI_GIRLS" }
 */
export const approveSmsenderId = asyncHandler(async (req, res) => {
  const { id: schoolId } = req.params;
  const { action, senderIdApproved, rejectionReason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return sendError(res, 'Action must be "approve" or "reject"', 400);
  }

  if (action === 'approve' && !senderIdApproved) {
    return sendError(res, 'senderIdApproved is required when action="approve"', 400);
  }

  if (action === 'approve' && !/^[A-Z0-9_]{1,11}$/.test(senderIdApproved)) {
    return sendError(res, 'Sender ID must be 1-11 alphanumeric chars', 400);
  }

  const updateData = {
    'smsSettings.senderIdStatus': action === 'approve' ? 'approved' : 'rejected',
  };

  if (action === 'approve') {
    updateData['smsSettings.senderIdApproved'] = senderIdApproved;
    updateData['smsSettings.approvedAt'] = new Date();
  } else if (rejectionReason) {
    updateData['smsSettings.rejectionReason'] = rejectionReason;
  }

  const school = await School.findByIdAndUpdate(
    schoolId,
    { $set: updateData },
    { new: true }
  ).select('name email smsSettings');

  if (!school) {
    return sendError(res, 'School not found', 404);
  }

  // Audit log
  await AuditLog.create({
    schoolId,
    userId: req.user._id,
    action: action === 'approve' ? 'sms_sender_approved' : 'sms_sender_rejected',
    resource: 'SchoolSmsSetting',
    metadata: {
      senderIdApproved: senderIdApproved || null,
      rejectionReason: rejectionReason || null,
    },
  });

  // Notify school by email (fire-and-forget)
  sendSenderIdReviewedEmail({
    to: school.email,
    schoolName: school.name,
    action,
    senderIdApproved: senderIdApproved || null,
    rejectionReason: rejectionReason || null,
    meta: { schoolId },
  }).catch(() => {});

  return sendSuccess(res, school, `Sender ID ${action}ed successfully`);
});

// ── GET /api/v1/admin/sms-analytics ─────────────────────────────────────────
/**
 * Platform-wide SMS consumption per school for the current (or specified) term.
 * Query: ?term=Term+1&academicYear=2026
 */
export const getSmsAnalytics = asyncHandler(async (req, res) => {
  const { term: qTerm, academicYear: qYear } = req.query;
  const { term, academicYear } = qTerm
    ? { term: qTerm, academicYear: qYear ?? String(new Date().getFullYear()) }
    : getCurrentTermAndYear();

  const stats = await SmsDelivery.aggregate([
    { $match: { term, academicYear } },
    {
      $group: {
        _id:       '$schoolId',
        total:     { $sum: 1 },
        delivered: { $sum: { $cond: [{ $eq: ['$deliveryStatus', SMS_DELIVERY_STATUS.DELIVERED] }, 1, 0] } },
        sent:      { $sum: { $cond: [{ $in: ['$deliveryStatus', [SMS_DELIVERY_STATUS.SENT, SMS_DELIVERY_STATUS.DELIVERED]] }, 1, 0] } },
        failed:    { $sum: { $cond: [{ $eq: ['$deliveryStatus', SMS_DELIVERY_STATUS.FAILED]    }, 1, 0] } },
        rejected:  { $sum: { $cond: [{ $eq: ['$deliveryStatus', SMS_DELIVERY_STATUS.REJECTED]  }, 1, 0] } },
        capped:    { $sum: { $cond: [{ $eq: ['$deliveryStatus', SMS_DELIVERY_STATUS.CAPPED]    }, 1, 0] } },
        purchased: { $sum: { $cond: [{ $eq: ['$creditType',     'purchased']                   }, 1, 0] } },
      },
    },
    {
      $lookup: {
        from: 'schools', localField: '_id', foreignField: '_id', as: 'school',
      },
    },
    { $unwind: '$school' },
    {
      $project: {
        schoolId:   '$_id',
        schoolName: '$school.name',
        total: 1, delivered: 1, sent: 1, failed: 1, rejected: 1, capped: 1, purchased: 1,
        purchasedRemaining: '$school.smsCredits.purchasedRemaining',
        deliveryRate: {
          $cond: [
            { $gt: ['$sent', 0] },
            { $round: [{ $multiply: [{ $divide: ['$delivered', '$sent'] }, 100] }, 1] },
            0,
          ],
        },
        successRate: {
          $cond: [
            { $gt: ['$total', 0] },
            { $round: [{ $multiply: [{ $divide: ['$sent', '$total'] }, 100] }, 1] },
            0,
          ],
        },
      },
    },
    { $sort: { total: -1 } },
  ]);

  return sendSuccess(res, { term, academicYear, schools: stats });
});

// ── School Groups ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/groups
 * Create a new billing group.
 */
export const createGroup = asyncHandler(async (req, res) => {
  const { name, notes, contactPerson, contactEmail } = req.body;
  if (!name?.trim()) return sendError(res, 'Group name is required.', 400);

  const group = await SchoolGroup.create({
    name: name.trim(),
    notes,
    contactPerson,
    contactEmail,
    createdBy: req.user._id,
  });

  return sendSuccess(res, { group }, 'Group created.', 201);
});

/**
 * GET /api/v1/admin/groups
 * List all billing groups, each with their member schools.
 */
export const listGroups = asyncHandler(async (req, res) => {
  const groups = await SchoolGroup.find().sort({ createdAt: -1 }).lean();

  const groupIds = groups.map((g) => g._id);
  const schools = await School.find({ groupId: { $in: groupIds } })
    .select('_id name email county subscriptionStatus planTier groupId')
    .lean();

  const schoolsByGroup = schools.reduce((acc, s) => {
    const key = s.groupId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const enriched = groups.map((g) => ({
    ...g,
    schools: schoolsByGroup[g._id.toString()] ?? [],
  }));

  return sendSuccess(res, { groups: enriched });
});

/**
 * GET /api/v1/admin/groups/:id
 * Single group with member schools and student count totals.
 */
export const getGroup = asyncHandler(async (req, res) => {
  const group = await SchoolGroup.findById(req.params.id).lean();
  if (!group) return sendError(res, 'Group not found.', 404);

  const schools = await School.find({ groupId: group._id })
    .select('_id name email county subscriptionStatus planTier')
    .lean();

  const schoolIds = schools.map((s) => s._id);
  const studentCounts = await Student.aggregate([
    { $match: { schoolId: { $in: schoolIds }, status: 'active' } },
    { $group: { _id: '$schoolId', count: { $sum: 1 } } },
  ]);
  const studentMap = studentCounts.reduce((acc, { _id, count }) => {
    acc[_id.toString()] = count;
    return acc;
  }, {});

  const schoolsWithCounts = schools.map((s) => ({
    ...s,
    activeStudents: studentMap[s._id.toString()] ?? 0,
  }));

  return sendSuccess(res, {
    group: {
      ...group,
      schools: schoolsWithCounts,
      totalActiveStudents: schoolsWithCounts.reduce((sum, s) => sum + s.activeStudents, 0),
    },
  });
});

/**
 * PATCH /api/v1/admin/groups/:id
 * Update group metadata.
 */
export const updateGroup = asyncHandler(async (req, res) => {
  const { name, notes, contactPerson, contactEmail } = req.body;
  const group = await SchoolGroup.findById(req.params.id);
  if (!group) return sendError(res, 'Group not found.', 404);

  if (name !== undefined) group.name = name.trim();
  if (notes !== undefined) group.notes = notes;
  if (contactPerson !== undefined) group.contactPerson = contactPerson;
  if (contactEmail !== undefined) group.contactEmail = contactEmail;

  await group.save();
  return sendSuccess(res, { group });
});

/**
 * DELETE /api/v1/admin/groups/:id
 * Delete a group. Member schools are detached (groupId set to null), not deleted.
 */
export const deleteGroup = asyncHandler(async (req, res) => {
  const group = await SchoolGroup.findById(req.params.id);
  if (!group) return sendError(res, 'Group not found.', 404);

  await School.updateMany({ groupId: group._id }, { $set: { groupId: null } });
  await group.deleteOne();

  return sendSuccess(res, { message: 'Group deleted. Member schools have been detached.' });
});

/**
 * POST /api/v1/admin/groups/:id/schools
 * Add a school to a group. Body: { schoolId }
 */
export const addSchoolToGroup = asyncHandler(async (req, res) => {
  const group = await SchoolGroup.findById(req.params.id);
  if (!group) return sendError(res, 'Group not found.', 404);

  const { schoolId } = req.body;
  if (!schoolId) return sendError(res, 'schoolId is required.', 400);

  const school = await School.findById(schoolId);
  if (!school) return sendError(res, 'School not found.', 404);

  school.groupId = group._id;
  await school.save();

  return sendSuccess(res, { school: { _id: school._id, name: school.name, groupId: school.groupId } });
});

/**
 * DELETE /api/v1/admin/groups/:id/schools/:schoolId
 * Remove a school from a group.
 */
export const removeSchoolFromGroup = asyncHandler(async (req, res) => {
  const school = await School.findOne({ _id: req.params.schoolId, groupId: req.params.id });
  if (!school) return sendError(res, 'School not found in this group.', 404);

  school.groupId = null;
  await school.save();

  return sendSuccess(res, { message: 'School removed from group.' });
});
