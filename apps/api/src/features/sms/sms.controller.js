/**
 * SMS Outbound Controller
 *
 * POST /api/v1/sms/send      — single message to one phone number
 * POST /api/v1/sms/broadcast — bulk to class parents, all parents, or all staff
 * GET  /api/v1/sms/history   — paginated log of sent messages
 *
 * Roles: secretary, accountant, deputy_headteacher, headteacher, director, school_admin
 */
import Student from '../students/Student.model.js';
import User from '../users/User.model.js';
import School from '../schools/School.model.js';
import FeeStructure from '../fees/FeeStructure.model.js';
import Payment from '../fees/Payment.model.js';
import SmsLog from './SmsLog.model.js';
import SmsDelivery from './SmsDelivery.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { smsQueue } from '../../jobs/queues.js';
import { env } from '../../config/env.js';
import { getRedis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import {
  SMS_TRIGGER_TYPES, JOB_NAMES, STUDENT_STATUSES,
  SMS_DELIVERY_STATUS, SMS_CREDIT_PACKS, PAYMENT_STATUSES,
} from '../../constants/index.js';
import { paginate } from '../../utils/pagination.js';
import { normalisePhone, isValidKenyanPhone } from './sms-inbound.controller.js';
import { getCurrentTermAndYear } from '../../utils/term.js';

const AT_CHUNK_SIZE = 200; // Africa's Talking recommended batch size
const MAX_SMS_CHARS = 480;

function atConfigured() {
  return !!(env.AT_USERNAME && env.AT_API_KEY);
}

const normaliseText = (value) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function addSchoolNameIfNeeded(message, schoolName) {
  const safeMessage = String(message ?? '').trim();
  const safeSchoolName = String(schoolName ?? '').trim();
  if (!safeSchoolName) return safeMessage;

  if (normaliseText(safeMessage).includes(normaliseText(safeSchoolName))) {
    return safeMessage;
  }

  return `${safeSchoolName}: ${safeMessage}`;
}

function collectGuardianPhones(students) {
  const phones = new Set();
  for (const student of students) {
    for (const g of (student.guardians ?? [])) {
      const p = normalisePhone(g.phone);
      if (p && isValidKenyanPhone(p)) phones.add(p);
    }
  }
  return [...phones];
}

async function queueSmsPayload(payload) {
  const redisReady = !!getRedis();
  if (redisReady) {
    try {
      await smsQueue.add(JOB_NAMES.SEND_SMS, payload);
      return;
    } catch (err) {
      logger.error('[SMS-OUTBOUND] Queue unavailable; falling back to direct send', {
        schoolId: payload.schoolId,
        smsLogId: payload.smsLogId,
        err: err.message,
      });
    }
  }

  const { processSmsJob } = await import('../../jobs/workers/sms.worker.js');
  await processSmsJob({
    id: `direct-${payload.smsLogId ?? Date.now()}`,
    data: payload,
  });
}

async function queueChunked({ to, message, schoolId, trigger, smsLogId }) {
  const recipients = Array.isArray(to) ? to : [to];
  for (let i = 0; i < recipients.length; i += AT_CHUNK_SIZE) {
    await queueSmsPayload({
      to: recipients.slice(i, i + AT_CHUNK_SIZE),
      message,
      schoolId,
      trigger,
      smsLogId,
    });
  }
}

const money = (amount) => `KES ${Math.round(amount).toLocaleString('en-KE')}`;

const fullName = (person) =>
  `${person?.firstName ?? ''} ${person?.lastName ?? ''}`.trim();

function buildStudentFeeLine(student, balance, options) {
  const parts = [];
  if (options.includeStudentName) parts.push(fullName(student) || 'Student');
  if (options.includeAdmissionNumber) parts.push(`Adm ${student.admissionNumber}`);

  const label = parts.length ? parts.join(' ') : 'Fee balance';
  return `${label}: ${money(balance)}`;
}

function clipMessage(message) {
  if (message.length <= MAX_SMS_CHARS) return message;
  return `${message.slice(0, MAX_SMS_CHARS - 3)}...`;
}

function buildFeeReminderMessages({ schoolName, parentName, lines, note, includeParentName }) {
  const greeting = includeParentName && parentName ? `Dear ${parentName}, ` : 'Dear Parent, ';
  const intro = `${greeting}${schoolName}: Fee balance reminder. `;
  const suffix = note ? ` ${note}` : '';
  const messages = [];
  let currentLines = [];

  for (const line of lines) {
    const candidateLines = [...currentLines, line];
    const candidate = `${intro}${candidateLines.join('; ')}.${suffix}`.trim();

    if (candidate.length > MAX_SMS_CHARS && currentLines.length > 0) {
      messages.push(clipMessage(`${intro}${currentLines.join('; ')}.${suffix}`.trim()));
      currentLines = [line];
    } else {
      currentLines = candidateLines;
    }
  }

  if (currentLines.length) {
    messages.push(clipMessage(`${intro}${currentLines.join('; ')}.${suffix}`.trim()));
  }

  return messages;
}

/**
 * POST /api/v1/sms/send
 * Body: { to: string, message: string }
 */
export const sendSingle = asyncHandler(async (req, res) => {
  if (!atConfigured()) {
    return sendError(res, 'SMS service is not configured on this server.', 503);
  }

  const { to, message } = req.body;
  const phone = normalisePhone(to);

  if (!phone || !isValidKenyanPhone(phone)) {
    return sendError(res, `Invalid Kenyan phone number: ${to}. Use format 07XX or +2547XX.`, 400);
  }

  const log = await SmsLog.create({
    schoolId: req.user.schoolId,
    trigger: SMS_TRIGGER_TYPES.CUSTOM_BROADCAST,
    target: 'single',
    message,
    recipientCount: 1,
    sentByUserId: req.user._id,
    status: 'queued',
  });

  await queueChunked({
    to: phone,
    message,
    schoolId: req.user.schoolId.toString(),
    trigger: SMS_TRIGGER_TYPES.CUSTOM_BROADCAST,
    smsLogId: log._id.toString(),
  });

  logger.info('[SMS-OUTBOUND] Single message queued', { schoolId: req.user.schoolId, phone });

  return sendSuccess(res, { smsLogId: log._id, recipientCount: 1 });
});

/**
 * POST /api/v1/sms/broadcast
 * Body: { target: 'class_parents'|'all_parents'|'all_staff', classId?: string, message: string }
 */
export const broadcastSms = asyncHandler(async (req, res) => {
  if (!atConfigured()) {
    return sendError(res, 'SMS service is not configured on this server.', 503);
  }

  const { target, classId, message } = req.body;
  const schoolId = req.user.schoolId;

  let phones = [];

  if (target === 'class_parents') {
    const students = await Student.find({
      schoolId, classId, status: STUDENT_STATUSES.ACTIVE,
    }).select('guardians');
    phones = collectGuardianPhones(students);
  } else if (target === 'all_parents') {
    const students = await Student.find({
      schoolId, status: STUDENT_STATUSES.ACTIVE,
    }).select('guardians');
    phones = collectGuardianPhones(students);
  } else if (target === 'all_staff') {
    const users = await User.find({ schoolId, isActive: true, role: { $ne: 'parent' } }).select('phone');
    const staffPhones = new Set();
    for (const u of users) {
      const p = normalisePhone(u.phone);
      if (p && isValidKenyanPhone(p)) staffPhones.add(p);
    }
    phones = [...staffPhones];
  }

  if (phones.length === 0) {
    return sendError(res, 'No valid recipients found for the selected target.', 422);
  }

  const log = await SmsLog.create({
    schoolId,
    trigger: SMS_TRIGGER_TYPES.CUSTOM_BROADCAST,
    target,
    classId: target === 'class_parents' ? classId : undefined,
    message,
    recipientCount: phones.length,
    sentByUserId: req.user._id,
    status: 'queued',
  });

  await queueChunked({
    to: phones,
    message,
    schoolId: schoolId.toString(),
    trigger: SMS_TRIGGER_TYPES.CUSTOM_BROADCAST,
    smsLogId: log._id.toString(),
  });

  logger.info('[SMS-OUTBOUND] Broadcast queued', {
    target, recipientCount: phones.length, schoolId,
  });

  return sendSuccess(res, { smsLogId: log._id, recipientCount: phones.length });
});

/**
 * POST /api/v1/sms/fee-reminders
 * Sends personalized fee balance reminders to parents/guardians.
 * Body: { target: 'all_students'|'class_students', classId?, includeParentName?, includeStudentName?, includeAdmissionNumber?, note? }
 */
export const sendFeeReminders = asyncHandler(async (req, res) => {
  if (!atConfigured()) {
    return sendError(res, 'SMS service is not configured on this server.', 503);
  }

  const {
    target,
    classId,
    includeParentName = true,
    includeStudentName = true,
    includeAdmissionNumber = true,
    note,
  } = req.body;
  const schoolId = req.user.schoolId;
  const { term, academicYear } = getCurrentTermAndYear();

  const school = await School.findById(schoolId).select('name').lean();
  if (!school) return sendError(res, 'School not found.', 404);

  const studentFilter = {
    schoolId,
    status: STUDENT_STATUSES.ACTIVE,
    ...(target === 'class_students' ? { classId } : {}),
  };

  const students = await Student.find(studentFilter)
    .select('firstName lastName admissionNumber classId guardians')
    .lean();

  if (!students.length) {
    return sendError(res, 'No active students found for the selected target.', 422);
  }

  const classIds = [...new Set(students.map((student) => String(student.classId)))];
  const studentIds = students.map((student) => student._id);

  const [structures, paidRows] = await Promise.all([
    FeeStructure.find({
      schoolId,
      classId: { $in: classIds },
      academicYear,
      term,
    }).select('classId totalAmount').lean(),
    Payment.aggregate([
      {
        $match: {
          schoolId,
          studentId: { $in: studentIds },
          academicYear,
          term,
          status: PAYMENT_STATUSES.COMPLETED,
        },
      },
      { $group: { _id: '$studentId', totalPaid: { $sum: '$amount' } } },
    ]),
  ]);

  const expectedByClass = new Map(
    structures.map((structure) => [String(structure.classId), Number(structure.totalAmount) || 0])
  );
  const paidByStudent = new Map(
    paidRows.map((row) => [String(row._id), Number(row.totalPaid) || 0])
  );

  const recipients = new Map();
  let studentsWithBalance = 0;

  for (const student of students) {
    const expected = expectedByClass.get(String(student.classId)) ?? 0;
    if (expected <= 0) continue;

    const paid = paidByStudent.get(String(student._id)) ?? 0;
    const balance = Math.max(0, expected - paid);
    if (balance <= 0) continue;

    studentsWithBalance += 1;
    const line = buildStudentFeeLine(student, balance, { includeStudentName, includeAdmissionNumber });

    for (const guardian of (student.guardians ?? [])) {
      const phone = normalisePhone(guardian.phone);
      if (!phone || !isValidKenyanPhone(phone)) continue;

      const existing = recipients.get(phone) ?? {
        phone,
        parentName: fullName(guardian),
        lines: [],
      };
      if (!existing.parentName) existing.parentName = fullName(guardian);
      existing.lines.push(line);
      recipients.set(phone, existing);
    }
  }

  if (!studentsWithBalance) {
    return sendError(res, 'No outstanding fee balances found for the selected students.', 422);
  }

  if (!recipients.size) {
    return sendError(res, 'Students with balances were found, but none have valid guardian phone numbers.', 422);
  }

  const messages = [];
  for (const recipient of recipients.values()) {
    const parentMessages = buildFeeReminderMessages({
      schoolName: school.name,
      parentName: recipient.parentName,
      lines: recipient.lines,
      note,
      includeParentName,
    });
    for (const message of parentMessages) {
      messages.push({ to: recipient.phone, message });
    }
  }

  const log = await SmsLog.create({
    schoolId,
    trigger: SMS_TRIGGER_TYPES.FEE_REMINDER,
    target: 'fee_balances',
    classId: target === 'class_students' ? classId : undefined,
    message: note ? `Fee balance reminder. ${note}` : 'Fee balance reminder',
    recipientCount: messages.length,
    sentByUserId: req.user._id,
    status: 'queued',
    term,
    academicYear,
  });

  for (const item of messages) {
    await queueSmsPayload({
      to: item.to,
      message: item.message,
      schoolId: schoolId.toString(),
      trigger: SMS_TRIGGER_TYPES.FEE_REMINDER,
      smsLogId: log._id.toString(),
      term,
      academicYear,
    });
  }

  logger.info('[SMS-OUTBOUND] Fee reminders queued', {
    schoolId,
    target,
    classId,
    studentsWithBalance,
    recipientCount: messages.length,
  });

  return sendSuccess(res, {
    smsLogId: log._id,
    recipientCount: messages.length,
    studentsWithBalance,
  });
});

/**
 * POST /api/v1/sms/test-direct
 * Sends via Africa's Talking synchronously (no queue) and returns the raw AT response.
 * Use this to verify credentials and diagnose delivery failures.
 * Body: { to: string, message: string }
 */
export const testSendDirect = asyncHandler(async (req, res) => {
  if (!atConfigured()) {
    return sendError(res, 'AT_USERNAME / AT_API_KEY not set in server env.', 503);
  }

  const { to, message = 'Test SMS from Diraschool' } = req.body;
  const phone = normalisePhone(to);

  if (!phone) {
    return sendError(res, `Cannot normalise phone: ${to}`, 400);
  }

  const recipients = env.AT_TEST_NUMBERS?.length
    ? env.AT_TEST_NUMBERS
    : [phone];

  let senderId = env.SMS_PLATFORM_SENDER_ID || null;
  let outboundMessage = message;

  try {
    const school = await School.findById(req.user.schoolId).select('name smsSettings').lean();
    if (school?.smsSettings?.senderIdApproved) {
      senderId = school.smsSettings.senderIdApproved;
    } else {
      outboundMessage = addSchoolNameIfNeeded(message, school?.name ?? 'Your school');
    }
  } catch (err) {
    logger.warn('[SMS-TEST] Could not resolve school sender details', { err: err.message });
    outboundMessage = addSchoolNameIfNeeded(message, 'Your school');
  }

  logger.info('[SMS-TEST] Direct send', { recipients, from: senderId ?? '(provider default)' });

  let atResult, atError;
  try {
    const AfricasTalking = (await import('africastalking')).default ?? await import('africastalking');
    const AT = AfricasTalking({ username: env.AT_USERNAME, apiKey: env.AT_API_KEY });
    const sms = AT.SMS;
    const params = { to: recipients, message: outboundMessage };
    if (senderId) params.from = senderId;
    atResult = await sms.send(params);
  } catch (err) {
    atError = err.message;
    logger.error('[SMS-TEST] Direct send failed', { err: err.message });
  }

  return sendSuccess(res, {
    config: {
      username: env.AT_USERNAME,
      senderId,
      testMode: !!(env.AT_TEST_NUMBERS?.length),
      testNumbers: env.AT_TEST_NUMBERS ?? null,
      recipients,
    },
    message: outboundMessage,
    atResult: atResult ?? null,
    atError: atError ?? null,
  });
});

/**
 * GET /api/v1/sms/history
 * Paginated SMS log for the school, with per-broadcast delivery summary.
 * Optional query: ?deliveryStatus=delivered|failed|capped
 */
export const smsHistory = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;
  const total = await SmsLog.countDocuments({ schoolId });
  const { skip, limit, meta } = paginate(req.query, total);

  const logs = await SmsLog.find({ schoolId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('sentByUserId', 'firstName lastName')
    .populate('classId', 'name')
    .lean();

  return sendSuccess(res, { logs, meta });
});

/**
 * GET /api/v1/sms/deliveries
 * Per-phone delivery records for a specific broadcast.
 * Query: smsLogId (required), deliveryStatus (optional filter)
 */
export const smsDeliveries = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;
  const { smsLogId, deliveryStatus } = req.query;
  if (!smsLogId) return sendError(res, 'smsLogId is required.', 400);

  const filter = { schoolId, smsLogId };
  if (deliveryStatus && Object.values(SMS_DELIVERY_STATUS).includes(deliveryStatus)) {
    filter.deliveryStatus = deliveryStatus;
  }

  const total = await SmsDelivery.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);
  const deliveries = await SmsDelivery.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return sendSuccess(res, { deliveries, meta });
});

/**
 * GET /api/v1/sms/stats
 * SMS usage summary for the current term — sent, delivered, failed, capped, credits.
 */
export const smsStats = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;
  const { term, academicYear } = getCurrentTermAndYear();

  const [aggregate] = await SmsDelivery.aggregate([
    { $match: { schoolId, term, academicYear } },
    {
      $group: {
        _id: null,
        total:     { $sum: 1 },
        sent:      { $sum: { $cond: [{ $in: ['$deliveryStatus', [SMS_DELIVERY_STATUS.SENT, SMS_DELIVERY_STATUS.DELIVERED]] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq:  ['$deliveryStatus', SMS_DELIVERY_STATUS.DELIVERED] }, 1, 0] } },
        failed:    { $sum: { $cond: [{ $eq:  ['$deliveryStatus', SMS_DELIVERY_STATUS.FAILED]    }, 1, 0] } },
        rejected:  { $sum: { $cond: [{ $eq:  ['$deliveryStatus', SMS_DELIVERY_STATUS.REJECTED]  }, 1, 0] } },
        capped:    { $sum: { $cond: [{ $eq:  ['$deliveryStatus', SMS_DELIVERY_STATUS.CAPPED]    }, 1, 0] } },
        purchased: { $sum: { $cond: [{ $eq:  ['$creditType',     'purchased']                   }, 1, 0] } },
      },
    },
  ]);

  const school = await School.findById(schoolId).select('smsCredits').lean();

  return sendSuccess(res, {
    term,
    academicYear,
    usage: aggregate ?? { total: 0, sent: 0, delivered: 0, failed: 0, rejected: 0, capped: 0, purchased: 0 },
    credits: {
      purchasedRemaining: school?.smsCredits?.purchasedRemaining ?? 0,
      totalPurchased:     school?.smsCredits?.totalPurchased     ?? 0,
    },
  });
});

/**
 * GET /api/v1/sms/credit-packs
 * List available SMS top-up packs.
 */
export const listCreditPacks = asyncHandler(async (req, res) => {
  return sendSuccess(res, { packs: SMS_CREDIT_PACKS });
});

/**
 * POST /api/v1/sms/credit-packs/checkout
 * Initiate Paystack checkout for an SMS credit pack.
 * Body: { packId: string }
 */
export const buyCreditPack = asyncHandler(async (req, res) => {
  if (!env.PAYSTACK_ENABLED) {
    return sendError(res, 'Paystack is not enabled in this environment.', 400);
  }

  const { packId } = req.body;
  const pack = SMS_CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) return sendError(res, 'Invalid SMS credit pack.', 400);

  const school = await School.findById(req.user.schoolId).lean();
  if (!school) return sendError(res, 'School not found.', 404);

  // Lazy import to avoid circular deps — Paystack service lives in subscriptions
  const { initializeTransaction } = await import('../subscriptions/paystack.service.js');
  const crypto = (await import('node:crypto')).default;

  const reference = `SMS-${String(school._id).slice(-6).toUpperCase()}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const callbackUrl = `${env.CLIENT_URL.replace(/\/+$/, '')}/billing/sms-credits?reference=${reference}`;

  const result = await initializeTransaction({
    email: school.email,
    amount: pack.amountKes * 100, // Paystack uses kobo/cents — but KES is already base unit; Paystack KES uses 1 unit = 1 KES
    reference,
    callbackUrl,
    metadata: {
      type:     'sms_credits',
      packId:   pack.id,
      credits:  pack.credits,
      schoolId: String(school._id),
    },
  });

  logger.info('[SMS-CREDITS] Checkout initiated', { schoolId: school._id, packId, credits: pack.credits, amountKes: pack.amountKes });

  return sendSuccess(res, {
    pack,
    checkout: {
      provider:          'paystack',
      merchantReference: reference,
      amountKes:         pack.amountKes,
      checkoutUrl:       result.authorization_url,
    },
  });
});

/**
 * POST /api/v1/sms/dlr
 * Africa's Talking delivery report webhook (public — no JWT).
 * AT sends: { id, status, phoneNumber, networkCode, failureReason, retryCount }
 */
export const handleDlr = asyncHandler(async (req, res) => {
  // Acknowledge immediately
  res.status(200).end();

  const { id: messageId, status, phoneNumber, failureReason } = req.body;
  if (!messageId) return;

  const deliveryStatus = status === 'Success'
    ? SMS_DELIVERY_STATUS.DELIVERED
    : status === 'Rejected'
      ? SMS_DELIVERY_STATUS.REJECTED
      : SMS_DELIVERY_STATUS.FAILED;

  try {
    await SmsDelivery.findOneAndUpdate(
      { messageId },
      { deliveryStatus, ...(failureReason ? { failureReason } : {}) }
    );
    logger.info('[SMS-DLR] Delivery status updated', { messageId, phoneNumber, status, deliveryStatus });
  } catch (err) {
    logger.error('[SMS-DLR] Failed to update delivery status', { messageId, err: err.message });
  }
});
