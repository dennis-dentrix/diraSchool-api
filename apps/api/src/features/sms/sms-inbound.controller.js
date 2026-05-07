/**
 * Payment SMS Inbound Webhook.
 *
 * Interim automation until direct M-Pesa Daraja / bank callbacks are available:
 *   payment SMS forwarded to /api/v1/sms/inbound
 *     -> parse provider amount/reference/payer details
 *     -> match exactly one active student by account reference or guardian phone
 *     -> create Payment(source = sms_webhook)
 *     -> keep unmatched/ambiguous messages in PaymentNotification for review
 *
 * The endpoint always returns HTTP 200 so webhook providers do not retry storms.
 */
import School from '../schools/School.model.js';
import Student from '../students/Student.model.js';
import Payment from '../fees/Payment.model.js';
import PaymentNotification from '../fees/PaymentNotification.model.js';
import SchoolSettings from '../settings/SchoolSettings.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { receiptQueue, smsQueue } from '../../jobs/queues.js';
import logger from '../../config/logger.js';
import { normalisePhone as normaliseKenyanPhone } from '../../utils/phone.js';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_SOURCE,
  PAYMENT_SMS_PROVIDERS,
  SMS_TRIGGER_TYPES,
  JOB_NAMES,
  STUDENT_STATUSES,
} from '../../constants/index.js';

export const normalisePhone = (raw) => {
  const normalized = normaliseKenyanPhone(raw);
  return normalized ? String(normalized).trim() : null;
};

// Valid Kenyan mobile E.164: +254 followed by exactly 9 digits.
export function isValidKenyanPhone(phone) {
  return /^\+254\d{9}$/.test(phone);
}

const extractAmount = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return Number(match[1].replace(/,/g, ''));
  }
  return null;
};

const extractPhone = (text) => {
  const match = text.match(/(?:\+?254|0)\d{9}\b/);
  return match ? normalisePhone(match[0]) : null;
};

const extractAccountReference = (text) => {
  const patterns = [
    /\b(?:account|a\/c|acc|bill\s*ref|paybill\s*ref|student\s*(?:no|number|ref|code))\b[^A-Z0-9]{0,12}([A-Z0-9_-]{2,30})/i,
    /\b(?:for|ref)\s+(?:adm|student|fee)?[^A-Z0-9]{0,8}([A-Z0-9_-]{3,30})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().toUpperCase();
  }
  return null;
};

const extractPayerName = (text) => {
  const match = text.match(/\bfrom\s+([A-Z][A-Z\s.'-]{2,80}?)(?:\s+(?:\+?254|0)\d{9}\b|\.|,|\son\s)/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
};

const parseMpesaSms = (text) => {
  const transactionId =
    text.match(/^\s*([A-Z0-9]{10})\s+Confirmed\b/i)?.[1] ||
    text.match(/\b(?:transaction|trans|txn)\s*(?:id|no|code)?[:.\s-]*([A-Z0-9]{6,})\b/i)?.[1] ||
    text.match(/\b([A-Z0-9]{10})\b/)?.[1] ||
    null;

  const amount = extractAmount(text, [
    /\b(?:received|paid|payment\s+of)\b.{0,60}?\b(?:KES|KSH|KSH\.)\s*([\d,]+(?:\.\d+)?)/i,
    /\b(?:KES|KSH|KSH\.)\s*([\d,]+(?:\.\d+)?).{0,60}?\b(?:received|paid|from)\b/i,
  ]);

  return {
    provider: PAYMENT_SMS_PROVIDERS.MPESA,
    ok: !!(amount && amount > 0 && transactionId),
    amount,
    senderPhone: extractPhone(text),
    transactionId: transactionId?.toUpperCase() ?? null,
    accountReference: extractAccountReference(text),
    payerName: extractPayerName(text),
  };
};

const parseBankSms = (text) => {
  const transactionId =
    text.match(/\b(?:ref|reference|rrn|ft|txn|transaction)\s*(?:id|no|code)?[:.\s-]*([A-Z0-9/-]{6,})\b/i)?.[1] ||
    text.match(/\b([A-Z]{2,5}\d{6,})\b/)?.[1] ||
    null;

  const amount = extractAmount(text, [
    /\b(?:credited|credit|deposit(?:ed)?|received|payment|paid|cr)\b.{0,80}?\b(?:KES|KSH|KSH\.)\s*([\d,]+(?:\.\d+)?)/i,
    /\b(?:KES|KSH|KSH\.)\s*([\d,]+(?:\.\d+)?).{0,80}?\b(?:credited|credit|deposit(?:ed)?|received|payment|paid|cr)\b/i,
  ]);

  return {
    provider: PAYMENT_SMS_PROVIDERS.BANK,
    ok: !!(amount && amount > 0 && transactionId),
    amount,
    senderPhone: extractPhone(text),
    transactionId: transactionId?.toUpperCase() ?? null,
    accountReference: extractAccountReference(text),
    payerName: extractPayerName(text),
  };
};

export const parsePaymentSms = (text, configuredProvider = PAYMENT_SMS_PROVIDERS.AUTO) => {
  const value = String(text || '').trim();
  if (!value) {
    return { provider: configuredProvider, ok: false, amount: null, reason: 'Empty message' };
  }

  if (configuredProvider === PAYMENT_SMS_PROVIDERS.MPESA) return parseMpesaSms(value);
  if (configuredProvider === PAYMENT_SMS_PROVIDERS.BANK) return parseBankSms(value);

  const mpesa = parseMpesaSms(value);
  if (mpesa.ok || /m-?pesa|safaricom|confirmed/i.test(value)) return mpesa;

  return parseBankSms(value);
};

// Returns { academicYear, term } for the period that includes today, or the
// most recently started term if today is between terms.
function resolveActivePeriod(settings) {
  const today = new Date();
  const year = settings?.currentAcademicYear ?? String(today.getFullYear());
  const terms = settings?.terms ?? [];

  const active = terms.find(
    (t) => today >= new Date(t.startDate) && today <= new Date(t.endDate)
  );
  if (active) return { academicYear: year, term: active.name };

  const started = terms
    .filter((t) => new Date(t.startDate) <= today)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  if (started.length) return { academicYear: year, term: started[0].name };

  logger.warn('[SMS-INBOUND] No active or past term found, defaulting to Term 1', {
    schoolId: settings?.schoolId,
    currentAcademicYear: year,
    configuredTerms: terms.length,
  });
  return { academicYear: year, term: 'Term 1' };
}

const resolveSchool = async (to) => {
  const rawTo = String(to || '').trim();
  const normalizedTo = normalisePhone(rawTo);
  const candidates = [...new Set([rawTo, normalizedTo].filter(Boolean))];
  if (!candidates.length) return null;

  return School.findOne({
    $or: [
      { 'paymentSmsSettings.phoneNumber': { $in: candidates } },
      { mpesaTillNumber: { $in: candidates } },
    ],
  }).select('_id name mpesaTillNumber paymentSmsSettings');
};

const saveNotification = async ({ school, parsed, status, reason, payload, student, payment }) => {
  try {
    return await PaymentNotification.create({
      schoolId: school._id,
      provider: parsed.provider,
      status,
      source: 'sms',
      messageId: payload.messageId,
      from: payload.from,
      to: payload.to,
      rawText: payload.text,
      amount: parsed.amount ?? undefined,
      senderPhone: parsed.senderPhone ?? undefined,
      payerName: parsed.payerName ?? undefined,
      transactionId: parsed.transactionId ?? undefined,
      accountReference: parsed.accountReference ?? undefined,
      matchedStudentId: student?._id,
      paymentId: payment?._id,
      reason,
    });
  } catch (err) {
    if (err?.code !== 11000) {
      logger.error('[SMS-INBOUND] Failed to save payment notification', {
        schoolId: school._id,
        err: err.message,
      });
    }
    return null;
  }
};

const studentRefs = (student) =>
  [student.admissionNumber, student.assessmentNumber]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase())
    .filter((v) => v.length >= 3);

const resolveStudentMatch = async ({ schoolId, parsed, text }) => {
  const students = await Student.find({
    schoolId,
    status: STUDENT_STATUSES.ACTIVE,
  }).select('_id classId guardians firstName lastName admissionNumber assessmentNumber').lean();

  const textUpper = String(text || '').toUpperCase();
  const accountReference = parsed.accountReference?.toUpperCase();

  if (accountReference) {
    const byAccount = students.filter((student) =>
      studentRefs(student).some((ref) => ref === accountReference)
    );
    if (byAccount.length === 1) return { status: 'matched', student: byAccount[0], strategy: 'account_reference' };
    if (byAccount.length > 1) return { status: 'ambiguous', reason: 'Account reference matched multiple students' };
  }

  const byTextReference = students.filter((student) =>
    studentRefs(student).some((ref) => textUpper.includes(ref))
  );
  if (byTextReference.length === 1) {
    return { status: 'matched', student: byTextReference[0], strategy: 'message_reference' };
  }
  if (byTextReference.length > 1) {
    return { status: 'ambiguous', reason: 'Message contains references for multiple students' };
  }

  if (parsed.senderPhone) {
    const byPhone = students.filter((student) =>
      student.guardians?.some((guardian) => normalisePhone(guardian.phone) === parsed.senderPhone)
    );
    if (byPhone.length === 1) return { status: 'matched', student: byPhone[0], strategy: 'guardian_phone' };
    if (byPhone.length > 1) return { status: 'ambiguous', reason: 'Payer phone is linked to multiple students' };
  }

  return { status: 'unmatched', reason: 'No student matched by account reference or guardian phone' };
};

const queueReceiptSms = async ({ school, student, payment, to }) => {
  if (!isValidKenyanPhone(to)) return;

  const receiptMsg =
    `${school.name}: Payment KES ${payment.amount.toLocaleString()} received for ` +
    `${student.firstName} ${student.lastName}. ` +
    `Receipt: ${payment.receiptNumber}. Thank you.`;

  try {
    await smsQueue.add(JOB_NAMES.SEND_SMS, {
      to,
      message: receiptMsg,
      schoolId: school._id.toString(),
      trigger: SMS_TRIGGER_TYPES.PAYMENT_RECEIPT,
    });
  } catch (err) {
    logger.error('[SMS-INBOUND] Failed to queue receipt SMS', { err: err.message });
  }
};

// ── POST /api/v1/sms/inbound ──────────────────────────────────────────────────
// Africa's Talking sends form-encoded data; simple SMS forwarders often send JSON.
export const handleInboundSms = asyncHandler(async (req, res) => {
  const payload = {
    from: req.body.from ?? req.body.sender ?? req.body.originator,
    to: req.body.to ?? req.body.recipient ?? req.body.phoneNumber,
    text: req.body.text ?? req.body.message ?? req.body.body,
    messageId: req.body.id ?? req.body.messageId ?? req.body.message_id,
  };

  logger.info('[SMS-INBOUND] Received', {
    messageId: payload.messageId,
    from: payload.from,
    to: payload.to,
    textLength: payload.text?.length,
  });

  const school = await resolveSchool(payload.to);
  if (!school) {
    logger.warn('[SMS-INBOUND] No school matched payment notification number', { to: payload.to });
    return sendSuccess(res, {});
  }

  const legacyMpesaMatch = !!school.mpesaTillNumber && normalisePhone(school.mpesaTillNumber) === normalisePhone(payload.to);
  const paymentSmsSettings = school.paymentSmsSettings ?? {};
  if (!paymentSmsSettings.enabled && !legacyMpesaMatch) {
    logger.warn('[SMS-INBOUND] Payment SMS automation disabled for school', { schoolId: school._id });
    return sendSuccess(res, {});
  }

  const provider = paymentSmsSettings.provider || PAYMENT_SMS_PROVIDERS.MPESA;
  const parsed = parsePaymentSms(payload.text, legacyMpesaMatch ? PAYMENT_SMS_PROVIDERS.MPESA : provider);
  if (!parsed.ok) {
    await saveNotification({
      school,
      parsed: { ...parsed, provider: parsed.provider || provider },
      status: 'parse_failed',
      reason: parsed.reason || 'Could not parse amount and transaction reference',
      payload,
    });
    logger.warn('[SMS-INBOUND] Could not parse payment SMS', { schoolId: school._id, provider, text: payload.text });
    return sendSuccess(res, {});
  }

  const existingPayment = await Payment.findOne({
    schoolId: school._id,
    reference: parsed.transactionId,
  }).select('_id');
  if (existingPayment) {
    await saveNotification({
      school,
      parsed,
      status: 'duplicate',
      reason: 'Transaction reference already exists as a payment',
      payload,
      payment: existingPayment,
    });
    logger.info('[SMS-INBOUND] Duplicate transaction, skipping', {
      schoolId: school._id,
      transactionId: parsed.transactionId,
    });
    return sendSuccess(res, {});
  }

  const match = await resolveStudentMatch({ schoolId: school._id, parsed, text: payload.text });
  if (match.status !== 'matched') {
    await saveNotification({
      school,
      parsed,
      status: match.status,
      reason: match.reason,
      payload,
    });
    logger.warn('[SMS-INBOUND] Payment SMS not auto-posted', {
      schoolId: school._id,
      transactionId: parsed.transactionId,
      status: match.status,
      reason: match.reason,
    });
    return sendSuccess(res, {});
  }

  const settings = await SchoolSettings.findOne({ schoolId: school._id });
  const { academicYear, term } = resolveActivePeriod(settings);
  const method = parsed.provider === PAYMENT_SMS_PROVIDERS.BANK
    ? PAYMENT_METHODS.BANK
    : PAYMENT_METHODS.MPESA;

  const payment = await Payment.create({
    schoolId: school._id,
    studentId: match.student._id,
    classId: match.student.classId,
    academicYear,
    term,
    amount: parsed.amount,
    method,
    reference: parsed.transactionId,
    source: PAYMENT_SOURCE.SMS_WEBHOOK,
    status: PAYMENT_STATUSES.COMPLETED,
    paymentDate: new Date(),
    notes: `Auto-recorded from ${parsed.provider} SMS (${match.strategy})`,
  });

  try {
    await receiptQueue.add(JOB_NAMES.GENERATE_PDF, {
      paymentId: payment._id.toString(),
      schoolId: school._id.toString(),
    });
  } catch (err) {
    logger.error('[SMS-INBOUND] Failed to queue receipt PDF', {
      paymentId: payment._id,
      err: err.message,
    });
  }

  await saveNotification({
    school,
    parsed,
    status: 'matched',
    reason: `Matched by ${match.strategy}`,
    payload,
    student: match.student,
    payment,
  });

  logger.info('[SMS-INBOUND] Payment created', {
    paymentId: payment._id,
    receiptNumber: payment.receiptNumber,
    student: `${match.student.firstName} ${match.student.lastName}`,
    amount: parsed.amount,
    provider: parsed.provider,
  });

  await queueReceiptSms({
    school,
    student: match.student,
    payment,
    to: parsed.senderPhone,
  });

  return sendSuccess(res, {});
});
