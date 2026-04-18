import FeeStructure from './FeeStructure.model.js';
import Payment from './Payment.model.js';
import Student from '../students/Student.model.js';
import Class from '../classes/Class.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { PAYMENT_STATUSES, STUDENT_STATUSES, JOB_NAMES, AUDIT_ACTIONS, AUDIT_RESOURCES } from '../../constants/index.js';
import { receiptQueue } from '../../jobs/queues.js';
import { logAction } from '../../utils/auditLogger.js';

// ── Fee Structures ────────────────────────────────────────────────────────────

/**
 * POST /api/v1/fees/structures
 * Defines the fee schedule for a class in a given term/year.
 */
export const createFeeStructure = asyncHandler(async (req, res) => {
  const { classId, academicYear, term, items } = req.body;

  // Verify class belongs to this school
  const cls = await Class.findOne({ _id: classId, schoolId: req.user.schoolId });
  if (!cls) return sendError(res, 'Class not found.', 404);

  const structure = await FeeStructure.create({
    schoolId: req.user.schoolId,
    classId,
    academicYear,
    term,
    items,
  });

  const populated = await FeeStructure.findById(structure._id).populate(
    'classId',
    'name stream levelCategory academicYear term'
  );

  return sendSuccess(res, { structure: populated }, 201);
});

/**
 * GET /api/v1/fees/structures
 */
export const listFeeStructures = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.term) filter.term = req.query.term;

  const total = await FeeStructure.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const structures = await FeeStructure.find(filter)
    .sort({ academicYear: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('classId', 'name stream levelCategory');

  return sendSuccess(res, { structures, meta });
});

/**
 * GET /api/v1/fees/structures/:id
 */
export const getFeeStructure = asyncHandler(async (req, res) => {
  const structure = await FeeStructure.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  }).populate('classId', 'name stream levelCategory academicYear term');

  if (!structure) return sendError(res, 'Fee structure not found.', 404);

  return sendSuccess(res, { structure });
});

/**
 * PATCH /api/v1/fees/structures/:id
 * Replaces the fee items (and recalculates totalAmount via pre-save hook).
 */
export const updateFeeStructure = asyncHandler(async (req, res) => {
  const structure = await FeeStructure.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!structure) return sendError(res, 'Fee structure not found.', 404);

  if (req.body.items !== undefined) {
    structure.items = req.body.items;
  }

  await structure.save(); // pre-save hook recalculates totalAmount

  return sendSuccess(res, { structure });
});

/**
 * DELETE /api/v1/fees/structures/:id
 * Blocked if any payments exist for this structure's term/year/class combo.
 */
export const deleteFeeStructure = asyncHandler(async (req, res) => {
  const structure = await FeeStructure.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!structure) return sendError(res, 'Fee structure not found.', 404);

  const paymentCount = await Payment.countDocuments({
    schoolId: req.user.schoolId,
    classId: structure.classId,
    academicYear: structure.academicYear,
    term: structure.term,
    status: PAYMENT_STATUSES.COMPLETED,
  });

  if (paymentCount > 0) {
    return sendError(
      res,
      `Cannot delete fee structure — ${paymentCount} payment(s) already recorded for this term.`,
      409
    );
  }

  await structure.deleteOne();
  return sendSuccess(res, { message: 'Fee structure deleted.' });
});

// ── Payments ──────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/fees/payments
 * Records a payment for a student in a specific term.
 */
export const createPayment = asyncHandler(async (req, res) => {
  const { studentId, academicYear, term, amount, method, reference, notes } = req.body;

  // Verify the student belongs to this school and is active
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.user.schoolId,
    status: STUDENT_STATUSES.ACTIVE,
  });
  if (!student) return sendError(res, 'Active student not found in this school.', 404);

  const payment = await Payment.create({
    schoolId: req.user.schoolId,
    studentId,
    classId: student.classId,
    academicYear,
    term,
    amount,
    method,
    reference: reference || undefined,
    notes: notes || undefined,
    status: PAYMENT_STATUSES.COMPLETED,
    recordedByUserId: req.user._id,
  });

  const populated = await Payment.findById(payment._id)
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role');

  logAction(req, {
    action: AUDIT_ACTIONS.CREATE,
    resource: AUDIT_RESOURCES.PAYMENT,
    resourceId: payment._id,
    meta: { amount, method, studentId: studentId.toString(), term, academicYear },
  });

  // Enqueue async PDF receipt generation (fire-and-forget — receipt arrives later via Cloudinary)
  try {
    await receiptQueue.add(JOB_NAMES.GENERATE_PDF, {
      paymentId: payment._id.toString(),
      schoolId: req.user.schoolId.toString(),
    });
  } catch {
    // Non-fatal — receipt generation will be retried or skipped; payment is already recorded
  }

  return sendSuccess(res, { payment: populated }, 201);
});

/**
 * GET /api/v1/fees/payments
 */
export const listPayments = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.reference = new RegExp(req.query.search.trim(), 'i');
  }

  const total = await Payment.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const payments = await Payment.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role');

  return sendSuccess(res, { payments, meta });
});

/**
 * GET /api/v1/fees/payments/:id
 */
export const getPayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  })
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role')
    .populate('reversedByUserId', 'firstName lastName role');

  if (!payment) return sendError(res, 'Payment not found.', 404);

  return sendSuccess(res, { payment });
});

/**
 * POST /api/v1/fees/payments/:id/reverse
 * Marks a completed payment as reversed (void/refund).
 */
export const reversePayment = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!payment) return sendError(res, 'Payment not found.', 404);

  if (payment.status === PAYMENT_STATUSES.REVERSED) {
    return sendError(res, 'Payment is already reversed.', 400);
  }

  payment.status = PAYMENT_STATUSES.REVERSED;
  payment.reversalReason = req.body.reversalReason;
  payment.reversedByUserId = req.user._id;
  payment.reversedAt = new Date();
  await payment.save();

  logAction(req, {
    action: AUDIT_ACTIONS.REVERSE,
    resource: AUDIT_RESOURCES.PAYMENT,
    resourceId: payment._id,
    meta: { reason: req.body.reversalReason, amount: payment.amount },
  });

  return sendSuccess(res, { payment });
});

// ── Balance ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/fees/balance?studentId=&academicYear=&term=
 * Computes outstanding fee balance for a student in a given term.
 *
 * balance = feeStructure.totalAmount - sum(completed payments)
 */
export const getStudentBalance = asyncHandler(async (req, res) => {
  const { studentId, academicYear, term } = req.query;

  // Verify student belongs to this school
  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.user.schoolId,
  }).populate('classId', 'name stream');

  if (!student) return sendError(res, 'Student not found.', 404);

  // Look up the fee structure for the student's class + term/year
  const structure = await FeeStructure.findOne({
    schoolId: req.user.schoolId,
    classId: student.classId,
    academicYear,
    term,
  });

  // Aggregate completed payments
  const [agg] = await Payment.aggregate([
    {
      $match: {
        schoolId: req.user.schoolId,
        studentId: student._id,
        academicYear,
        term,
        status: PAYMENT_STATUSES.COMPLETED,
      },
    },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);

  const totalPaid = agg?.totalPaid ?? 0;
  const expectedFee = structure?.totalAmount ?? 0;
  const outstanding = Math.max(0, expectedFee - totalPaid);
  const overpaid = Math.max(0, totalPaid - expectedFee);

  return sendSuccess(res, {
    student: {
      _id: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      admissionNumber: student.admissionNumber,
      classId: student.classId,
    },
    academicYear,
    term,
    feeStructure: structure
      ? { _id: structure._id, totalAmount: structure.totalAmount, items: structure.items }
      : null,
    totalPaid,
    outstanding,
    overpaid,
    isPaidUp: outstanding === 0,
  });
});
