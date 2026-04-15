/**
 * School-admin dashboard controller.
 *
 * GET /api/v1/dashboard
 *
 * Returns a summary of the authenticated user's school:
 *   - school info (name, status, plan, trial expiry)
 *   - staff counts by role
 *   - student count (total + by status)
 *   - pending actions (users who haven't logged in yet, expired trial warning)
 *
 * Accessible to all admin roles (school_admin, director, headteacher, deputy_headteacher).
 * Teachers, parents, and secretaries are redirected — they have no admin dashboard.
 */
import School   from '../schools/School.model.js';
import User     from '../users/User.model.js';
import Student  from '../students/Student.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError, sendForbidden } from '../../utils/response.js';
import { ADMIN_ROLES } from '../../constants/index.js';

export const getDashboard = asyncHandler(async (req, res) => {
  // Only admin roles get a dashboard
  if (!ADMIN_ROLES.includes(req.user.role)) {
    return sendForbidden(res, 'Dashboard is only available to school administrators.');
  }

  const schoolId = req.user.schoolId;

  const [school, staffByRole, studentStats, pendingUsers] = await Promise.all([
    // School record
    School.findById(schoolId)
      .select('name email phone county subscriptionStatus planTier trialExpiry isActive createdAt')
      .lean(),

    // Staff breakdown by role
    User.aggregate([
      { $match: { schoolId, isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort:  { _id: 1 } },
    ]),

    // Student counts (total + by status)
    Student.aggregate([
      { $match: { schoolId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Staff who have never logged in (may need follow-up)
    User.countDocuments({
      schoolId,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: { $exists: false },
    }),
  ]);

  if (!school) return sendError(res, 'School not found.', 404);

  // ── Trial expiry warning ───────────────────────────────────────────────────
  const trialDaysLeft =
    school.subscriptionStatus === 'trial' && school.trialExpiry
      ? Math.max(
          0,
          Math.ceil((new Date(school.trialExpiry) - new Date()) / (1000 * 60 * 60 * 24))
        )
      : null;

  // ── Flatten staff counts ───────────────────────────────────────────────────
  const staffSummary = staffByRole.reduce(
    (acc, { _id, count }) => {
      acc.byRole[_id] = count;
      acc.total += count;
      return acc;
    },
    { total: 0, byRole: {} }
  );

  // ── Flatten student counts ─────────────────────────────────────────────────
  const studentSummary = studentStats.reduce(
    (acc, { _id, count }) => {
      acc.byStatus[_id ?? 'unknown'] = count;
      acc.total += count;
      return acc;
    },
    { total: 0, byStatus: {} }
  );

  return sendSuccess(res, {
    school: {
      _id:                school._id,
      name:               school.name,
      email:              school.email,
      phone:              school.phone,
      county:             school.county,
      subscriptionStatus: school.subscriptionStatus,
      planTier:           school.planTier,
      trialExpiry:        school.trialExpiry,
      trialDaysLeft,       // null when not on trial
      isActive:           school.isActive,
      createdAt:          school.createdAt,
    },
    staff:    staffSummary,
    students: studentSummary,
    alerts: {
      // Staff who haven't set their password yet
      staffAwaitingFirstLogin: pendingUsers,
      // Warn when ≤ 7 days left on trial
      trialExpiringSoon: trialDaysLeft !== null && trialDaysLeft <= 7,
    },
  });
});
