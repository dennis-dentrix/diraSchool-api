/**
 * School-admin dashboard controller.
 *
 * GET /api/v1/dashboard
 *
 * Returns a summary of the authenticated user's school:
 *   - school info (name, status, plan, trial expiry)
 *   - staff counts by role
 *   - student count (total + by status)
 *   - fee summary (collected, target, by class, recent payments)
 *   - pending actions
 *
 * Accessible to all admin roles (school_admin, director, headteacher, deputy_headteacher).
 */
import School        from '../schools/School.model.js';
import User          from '../users/User.model.js';
import Student       from '../students/Student.model.js';
import Payment       from '../fees/Payment.model.js';
import FeeStructure  from '../fees/FeeStructure.model.js';
import asyncHandler  from '../../utils/asyncHandler.js';
import { sendSuccess, sendError, sendForbidden } from '../../utils/response.js';
import { ADMIN_ROLES, ROLES } from '../../constants/index.js';

const FINANCE_ROLES = [ROLES.SECRETARY, ROLES.ACCOUNTANT];

export const getDashboard = asyncHandler(async (req, res) => {
  // Secretary and accountant get a fee-focused summary instead of full admin dashboard
  if (FINANCE_ROLES.includes(req.user.role)) {
    return getFinanceDashboard(req, res);
  }

  if (!ADMIN_ROLES.includes(req.user.role)) {
    return sendForbidden(res, 'Dashboard is only available to school administrators.');
  }

  const schoolId = req.user.schoolId;
  const currentYear = String(new Date().getFullYear());
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [school, staffByRole, studentStats, pendingUsers, feeStructures, paymentStats, studentsByClass, studentsWithPayments] = await Promise.all([
    School.findById(schoolId)
      .select('name email phone county subscriptionStatus planTier trialExpiry isActive createdAt')
      .lean(),

    User.aggregate([
      { $match: { schoolId, isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
      { $sort:  { _id: 1 } },
    ]),

    Student.aggregate([
      { $match: { schoolId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    User.countDocuments({
      schoolId,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: { $exists: false },
    }),

    // Fee structures for current year — to compute targets per class
    FeeStructure.find({ schoolId, academicYear: currentYear })
      .populate('classId', 'name stream')
      .lean(),

    // Payment aggregation — totals, method breakdown, and recent
    Payment.aggregate([
      { $match: { schoolId } },
      {
        $facet: {
          allTime:   [{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }],
          today:     [{ $match: { status: 'completed', createdAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }],
          month:     [{ $match: { status: 'completed', createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' } } }],
          byClass:   [{ $match: { status: 'completed' } }, { $group: { _id: '$classId', collected: { $sum: '$amount' } } }],
          byMethod:  [{ $match: { status: 'completed' } }, { $group: { _id: '$method', total: { $sum: '$amount' } } }],
          pending:   [{ $match: { status: 'pending' } }, { $group: { _id: null, count: { $sum: 1 } } }],
          recent: [
            { $match: { status: 'completed' } },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
            { $unwind: '$student' },
            { $project: { amount: 1, method: 1, status: 1, createdAt: 1, 'student.firstName': 1, 'student.lastName': 1 } },
          ],
        },
      },
    ]),

    // Active student count per class
    Student.aggregate([
      { $match: { schoolId, status: 'active' } },
      { $group: { _id: '$classId', count: { $sum: 1 } } },
    ]),

    // Distinct students who have made at least one payment this year (per class)
    Payment.aggregate([
      { $match: { schoolId, academicYear: currentYear, status: 'completed' } },
      { $group: { _id: { classId: '$classId', studentId: '$studentId' } } },
      { $group: { _id: '$_id.classId', paidCount: { $sum: 1 } } },
    ]),
  ]);

  if (!school) return sendError(res, 'School not found.', 404);

  // ── Trial expiry ───────────────────────────────────────────────────────────
  const trialDaysLeft =
    school.subscriptionStatus === 'trial' && school.trialExpiry
      ? Math.max(0, Math.ceil((new Date(school.trialExpiry) - new Date()) / (1000 * 60 * 60 * 24)))
      : null;

  // ── Staff summary ──────────────────────────────────────────────────────────
  const staffSummary = staffByRole.reduce(
    (acc, { _id, count }) => { acc.byRole[_id] = count; acc.total += count; return acc; },
    { total: 0, byRole: {} }
  );

  // ── Student summary ────────────────────────────────────────────────────────
  const studentSummary = studentStats.reduce(
    (acc, { _id, count }) => { acc.byStatus[_id ?? 'unknown'] = count; acc.total += count; return acc; },
    { total: 0, byStatus: {} }
  );

  // ── Fee summary ────────────────────────────────────────────────────────────
  const facet = paymentStats[0] ?? {};
  const totalCollected  = facet.allTime?.[0]?.total  ?? 0;
  const todayAmount     = facet.today?.[0]?.total    ?? 0;
  const monthAmount     = facet.month?.[0]?.total    ?? 0;
  const pendingReceipts = facet.pending?.[0]?.count  ?? 0;

  const methodBreakdown = Object.fromEntries(
    (facet.byMethod ?? []).map((m) => [m._id ?? 'unknown', m.total])
  );

  // Build lookup maps
  const studentCountMap = Object.fromEntries(studentsByClass.map((s) => [String(s._id), s.count]));
  const collectedMap    = Object.fromEntries((facet.byClass ?? []).map((p) => [String(p._id), p.collected]));
  const paidCountMap    = Object.fromEntries(studentsWithPayments.map((p) => [String(p._id), p.paidCount]));

  // Aggregate fee structures by classId (sum across terms)
  const targetByClass = {};
  for (const fs of feeStructures) {
    if (!fs.classId) continue;
    const id = String(fs.classId._id);
    if (!targetByClass[id]) {
      targetByClass[id] = {
        name: `${fs.classId.name}${fs.classId.stream ? ` ${fs.classId.stream}` : ''}`,
        totalPerStudent: 0,
      };
    }
    targetByClass[id].totalPerStudent += fs.totalAmount;
  }

  let totalTarget = 0;
  let studentsOverdue = 0;
  let amountOverdue = 0;
  const byClass = {};

  for (const [classId, data] of Object.entries(targetByClass)) {
    const studentCount = studentCountMap[classId] ?? 0;
    const target       = data.totalPerStudent * studentCount;
    const collected    = collectedMap[classId]  ?? 0;
    const paidCount    = paidCountMap[classId]  ?? 0;
    const unpaid       = studentCount - paidCount;

    totalTarget    += target;
    studentsOverdue += unpaid;
    amountOverdue  += Math.max(0, target - collected);

    if (studentCount > 0 && target > 0) {
      byClass[data.name] = {
        percent:   Math.min(100, Math.round((collected / target) * 100)),
        paidCount,
        total: studentCount,
      };
    }
  }

  const recentPayments = (facet.recent ?? []).map((p) => ({
    name:   `${p.student.firstName} ${p.student.lastName}`,
    amount: p.amount,
    method: p.method,
    time:   new Date(p.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
    status: p.status,
  }));

  const fees = {
    totalCollected,
    totalTarget,
    studentsOverdue,
    amountOverdue,
    studentsToFollowUp: studentsOverdue,
    pendingReceipts,
    methodBreakdown,
    todayAmount,
    monthAmount,
    byClass,
    recentPayments,
  };

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
      trialDaysLeft,
      isActive:           school.isActive,
      createdAt:          school.createdAt,
    },
    fees,
    staff:    staffSummary,
    students: studentSummary,
    alerts: {
      staffAwaitingFirstLogin: pendingUsers,
      trialExpiringSoon: trialDaysLeft !== null && trialDaysLeft <= 7,
    },
  });
});

// ── Finance dashboard (secretary / accountant) ────────────────────────────────
async function getFinanceDashboard(req, res) {
  const schoolId = req.user.schoolId;
  const now = new Date();
  const todayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentYear = String(now.getFullYear());

  const [school, studentCount, paymentStats] = await Promise.all([
    School.findById(schoolId).select('name subscriptionStatus planTier').lean(),
    Student.countDocuments({ schoolId, status: 'active' }),
    Payment.aggregate([
      { $match: { schoolId } },
      {
        $facet: {
          allTime:  [{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }],
          today:    [{ $match: { status: 'completed', createdAt: { $gte: todayStart } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }],
          month:    [{ $match: { status: 'completed', createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }],
          pending:  [{ $match: { status: 'pending' } }, { $group: { _id: null, count: { $sum: 1 } } }],
          byMethod: [{ $match: { status: 'completed' } }, { $group: { _id: '$method', total: { $sum: '$amount' } } }],
          recent: [
            { $match: { status: 'completed' } },
            { $sort: { createdAt: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'students', localField: 'studentId', foreignField: '_id', as: 'student' } },
            { $unwind: { path: '$student', preserveNullAndEmpty: true } },
            { $project: { amount: 1, method: 1, status: 1, createdAt: 1, receiptNumber: 1, 'student.firstName': 1, 'student.lastName': 1 } },
          ],
        },
      },
    ]),
  ]);

  if (!school) return sendError(res, 'School not found.', 404);

  const facet = paymentStats[0] ?? {};

  const fees = {
    totalCollected: facet.allTime?.[0]?.total ?? 0,
    todayAmount:    facet.today?.[0]?.total   ?? 0,
    todayCount:     facet.today?.[0]?.count   ?? 0,
    monthAmount:    facet.month?.[0]?.total   ?? 0,
    monthCount:     facet.month?.[0]?.count   ?? 0,
    pendingReceipts: facet.pending?.[0]?.count ?? 0,
    methodBreakdown: Object.fromEntries((facet.byMethod ?? []).map((m) => [m._id ?? 'unknown', m.total])),
    recentPayments: (facet.recent ?? []).map((p) => ({
      name:          `${p.student?.firstName ?? '—'} ${p.student?.lastName ?? ''}`.trim(),
      amount:        p.amount,
      method:        p.method,
      receiptNumber: p.receiptNumber,
      time:          new Date(p.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }),
      status:        p.status,
    })),
  };

  return sendSuccess(res, {
    school: { _id: school._id, name: school.name, subscriptionStatus: school.subscriptionStatus },
    fees,
    students: { total: studentCount, activeCount: studentCount },
    // Minimal shape so the frontend dashboard can render without crashing
    staff:    { total: 0, byRole: {} },
    alerts:   { staffAwaitingFirstLogin: 0, trialExpiringSoon: false },
  });
}
