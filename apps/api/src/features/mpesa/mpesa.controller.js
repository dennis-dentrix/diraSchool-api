import Payment from '../fees/Payment.model.js';
import PaymentNotification from '../fees/PaymentNotification.model.js';
import School from '../schools/School.model.js';
import Student from '../students/Student.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { paginate } from '../../utils/pagination.js';
import { sendSuccess, sendError, sendForbidden } from '../../utils/response.js';
import { logAction } from '../../utils/auditLogger.js';
import logger from '../../config/logger.js';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  PAYMENT_SOURCE,
  PAYMENT_STATUSES,
  STUDENT_STATUSES,
} from '../../constants/index.js';
import {
  MPESA_NOTIFICATION_SOURCE,
  computeStudentBalance,
  createPaymentForStudent,
  emitPaymentUpdates,
  getFinanceSummary,
  processConfirmationPayload,
  queueReceiptPdf,
  registerC2BUrls,
  resolveActivePeriod,
} from './mpesa.service.js';

const UNALLOCATED_STATUSES = ['unmatched', 'ambiguous', 'parse_failed'];

const studentName = (student) => `${student.firstName} ${student.lastName}`.trim();

const buildDateRange = ({ from, to }) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
};

export const validationCallback = (req, res) => {
  logger.info('[M-PESA] Validation callback accepted', {
    transactionId: req.body?.TransID,
    paybill: req.body?.BusinessShortCode,
    accountRef: req.body?.BillRefNumber,
  });

  return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

export const confirmationCallback = (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Success' });

  void processConfirmationPayload(req.body).catch((err) => {
    logger.error('[M-PESA] Confirmation processing failed', {
      transactionId: req.body?.TransID,
      paybill: req.body?.BusinessShortCode,
      err: err.message,
      stack: err.stack,
    });
  });
};

export const getMpesaSettings = asyncHandler(async (req, res) => {
  const [school, firstStudent] = await Promise.all([
    School.findById(req.user.schoolId)
      .select('mpesa name')
      .lean(),
    Student.findOne({
      schoolId: req.user.schoolId,
      status: STUDENT_STATUSES.ACTIVE,
    })
      .select('admissionNumber')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  if (!school) return sendError(res, 'School not found.', 404);

  return sendSuccess(res, {
    settings: {
      paybill: school.mpesa?.paybill ?? '',
      authorized: !!school.mpesa?.authorized,
      authorizedAt: school.mpesa?.authorizedAt ?? null,
      authorizationLetterUrl: school.mpesa?.authorizationLetterUrl ?? null,
      c2bRegistered: !!school.mpesa?.c2bRegistered,
      c2bRegisteredAt: school.mpesa?.c2bRegisteredAt ?? null,
      active: !!school.mpesa?.active,
      lastRegistrationResponse: school.mpesa?.lastRegistrationResponse ?? null,
      callbackUrls: {
        confirmation: '/api/v1/mpesa/confirmation',
        validation: '/api/v1/mpesa/validation',
      },
      testAdmissionNumber: firstStudent?.admissionNumber ?? null,
    },
  });
});

export const updateMpesaSettings = asyncHandler(async (req, res) => {
  const paybill = req.body.paybill.trim();

  const duplicate = await School.findOne({
    _id: { $ne: req.user.schoolId },
    'mpesa.paybill': paybill,
  }).select('_id name');

  if (duplicate) {
    return sendError(res, 'This Paybill is already configured for another school.', 409);
  }

  const school = await School.findByIdAndUpdate(
    req.user.schoolId,
    {
      $set: {
        'mpesa.paybill': paybill,
        'mpesa.c2bRegistered': false,
        'mpesa.active': false,
      },
      $unset: {
        'mpesa.c2bRegisteredAt': '',
        'mpesa.lastRegistrationResponse': '',
      },
    },
    { new: true }
  ).select('mpesa');

  if (!school) return sendError(res, 'School not found.', 404);

  logAction(req, {
    action: AUDIT_ACTIONS.UPDATE,
    resource: AUDIT_RESOURCES.SCHOOL,
    resourceId: req.user.schoolId,
    meta: { mpesaPaybill: paybill },
  });

  return sendSuccess(res, {
    message: 'M-Pesa Paybill saved. Connect M-Pesa to register callback URLs.',
    settings: school.mpesa,
  });
});

export const registerC2B = asyncHandler(async (req, res) => {
  if (String(req.params.schoolId) !== String(req.user.schoolId)) {
    return sendForbidden(res, 'You can only register M-Pesa for your own school.');
  }

  const school = await School.findById(req.user.schoolId).select('mpesa name');
  if (!school) return sendError(res, 'School not found.', 404);
  if (!school.mpesa?.paybill) return sendError(res, 'Set the school Paybill before connecting M-Pesa.', 400);

  const providerResponse = await registerC2BUrls(school.mpesa.paybill);

  school.mpesa.c2bRegistered = true;
  school.mpesa.c2bRegisteredAt = new Date();
  school.mpesa.active = true;
  school.mpesa.lastRegistrationResponse = providerResponse;
  await school.save();

  logAction(req, {
    action: AUDIT_ACTIONS.UPDATE,
    resource: AUDIT_RESOURCES.SCHOOL,
    resourceId: school._id,
    meta: { mpesaPaybill: school.mpesa.paybill, mpesaConnected: true },
  });

  return sendSuccess(res, {
    message: `M-Pesa connected. Payments to Paybill ${school.mpesa.paybill} will now be recorded automatically.`,
    providerResponse,
    settings: school.mpesa,
  });
});

export const createManualPayment = asyncHandler(async (req, res) => {
  const { studentId, amount, paymentMethod, reference, paymentDate, notes } = req.body;
  const activePeriod = await resolveActivePeriod(req.user.schoolId);
  const academicYear = req.body.academicYear ?? activePeriod.academicYear;
  const term = req.body.term ?? activePeriod.term;

  const student = await Student.findOne({
    _id: studentId,
    schoolId: req.user.schoolId,
    status: STUDENT_STATUSES.ACTIVE,
  }).select('_id classId firstName lastName admissionNumber');

  if (!student) return sendError(res, 'Active student not found in this school.', 404);

  const payment = await Payment.create({
    schoolId: req.user.schoolId,
    studentId,
    classId: student.classId,
    academicYear,
    term,
    amount,
    method: paymentMethod,
    reference,
    source: PAYMENT_SOURCE.MANUAL,
    status: PAYMENT_STATUSES.COMPLETED,
    notes,
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    recordedByUserId: req.user._id,
  });

  await queueReceiptPdf({ paymentId: payment._id, schoolId: req.user.schoolId });

  const balance = await computeStudentBalance({
    schoolId: req.user.schoolId,
    studentId: student._id,
    classId: student.classId,
    academicYear,
    term,
  });

  const populated = await Payment.findById(payment._id)
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role')
    .lean();

  logAction(req, {
    action: AUDIT_ACTIONS.CREATE,
    resource: AUDIT_RESOURCES.PAYMENT,
    resourceId: payment._id,
    meta: { amount, method: paymentMethod, studentId: String(studentId), term, academicYear },
  });

  return sendSuccess(res, { payment: populated, balance }, 201);
});

export const allocateUnallocatedPayment = asyncHandler(async (req, res) => {
  const { unallocatedPaymentId, studentId, notes } = req.body;

  const [school, notification, student] = await Promise.all([
    School.findById(req.user.schoolId).select('_id name').lean(),
    PaymentNotification.findOne({
      _id: unallocatedPaymentId,
      schoolId: req.user.schoolId,
      source: MPESA_NOTIFICATION_SOURCE,
      status: { $in: UNALLOCATED_STATUSES },
    }),
    Student.findOne({
      _id: studentId,
      schoolId: req.user.schoolId,
      status: STUDENT_STATUSES.ACTIVE,
    }).select('_id classId firstName lastName admissionNumber').lean(),
  ]);

  if (!school) return sendError(res, 'School not found.', 404);
  if (!notification) return sendError(res, 'Unallocated M-Pesa payment not found.', 404);
  if (!student) return sendError(res, 'Active student not found in this school.', 404);
  if (!notification.transactionId) return sendError(res, 'Cannot allocate a payment without an M-Pesa code.', 400);

  const existingPayment = await Payment.findOne({
    schoolId: req.user.schoolId,
    reference: notification.transactionId,
  }).select('_id');

  if (existingPayment) {
    return sendError(res, 'This M-Pesa payment has already been recorded.', 409);
  }

  const { payment, balance } = await createPaymentForStudent({
    school,
    student,
    amount: notification.amount,
    reference: notification.transactionId,
    accountReference: notification.accountReference,
    payerPhone: notification.senderPhone,
    payerName: notification.payerName,
    paymentDate: notification.parsedAt ?? notification.createdAt,
    notes: notes || 'Allocated from unallocated Daraja C2B callback',
    recordedByUserId: req.user._id,
  });

  notification.status = 'allocated';
  notification.matchedStudentId = student._id;
  notification.paymentId = payment._id;
  notification.allocatedByUserId = req.user._id;
  notification.allocatedAt = new Date();
  notification.reason = notes || `Allocated to ${studentName(student)} (${student.admissionNumber})`;
  await notification.save();

  await emitPaymentUpdates({ school, student, payment, balance });

  logAction(req, {
    action: AUDIT_ACTIONS.UPDATE,
    resource: AUDIT_RESOURCES.PAYMENT,
    resourceId: payment._id,
    meta: {
      allocatedNotificationId: String(notification._id),
      studentId: String(student._id),
      mpesaCode: payment.reference,
    },
  });

  const populated = await Payment.findById(payment._id)
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role')
    .lean();

  return sendSuccess(res, { payment: populated, notification, balance }, 201);
});

export const listMpesaPayments = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };

  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.classId) filter.classId = req.query.classId;
  if (req.query.paymentMethod) filter.method = req.query.paymentMethod;
  if (req.query.status) filter.status = req.query.status;

  const dateRange = buildDateRange(req.query);
  if (dateRange) filter.paymentDate = dateRange;

  const total = await Payment.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const payments = await Payment.find(filter)
    .sort({ paymentDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('studentId', 'firstName lastName admissionNumber')
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role')
    .populate('receiptIssuedByUserId', 'firstName lastName role')
    .lean();

  return sendSuccess(res, { payments, meta });
});

export const listStudentPayments = asyncHandler(async (req, res) => {
  const student = await Student.findOne({
    _id: req.params.studentId,
    schoolId: req.user.schoolId,
  }).select('_id firstName lastName admissionNumber');

  if (!student) return sendError(res, 'Student not found.', 404);

  const payments = await Payment.find({
    schoolId: req.user.schoolId,
    studentId: student._id,
  })
    .sort({ paymentDate: -1, createdAt: -1 })
    .populate('classId', 'name stream')
    .populate('recordedByUserId', 'firstName lastName role')
    .populate('receiptIssuedByUserId', 'firstName lastName role')
    .lean();

  return sendSuccess(res, { student, payments });
});

export const listUnallocatedPayments = asyncHandler(async (req, res) => {
  const filter = {
    schoolId: req.user.schoolId,
    source: MPESA_NOTIFICATION_SOURCE,
    status: req.query.status ?? { $in: UNALLOCATED_STATUSES },
  };

  const total = await PaymentNotification.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const payments = await PaymentNotification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('matchedStudentId', 'firstName lastName admissionNumber')
    .populate('paymentId', 'amount method reference receiptNumber status')
    .populate('allocatedByUserId', 'firstName lastName role')
    .lean();

  return sendSuccess(res, { payments, meta });
});

export const getMpesaSummary = asyncHandler(async (req, res) => {
  const summary = await getFinanceSummary(req.user.schoolId);
  return sendSuccess(res, { summary });
});
