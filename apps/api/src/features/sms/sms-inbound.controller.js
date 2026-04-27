/**
 * SMS Inbound Webhook — receives forwarded M-Pesa payment SMSes from Africa's Talking.
 *
 * Flow:
 *   Africa's Talking receives SMS on school's registered number
 *     → POST /api/v1/sms/inbound (form-encoded by AT)
 *     → Parse SMS for amount / sender phone / transaction ID
 *     → Match sender phone against student guardian phones
 *     → Create Payment record (source = sms_webhook)
 *     → Queue receipt SMS back to parent
 */
import School           from '../schools/School.model.js';
import Student          from '../students/Student.model.js';
import Payment          from '../fees/Payment.model.js';
import SchoolSettings   from '../settings/SchoolSettings.model.js';
import asyncHandler     from '../../utils/asyncHandler.js';
import { sendSuccess }  from '../../utils/response.js';
import { smsQueue }     from '../../jobs/queues.js';
import logger           from '../../config/logger.js';
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_SOURCE,
  SMS_TRIGGER_TYPES,
  JOB_NAMES,
  STUDENT_STATUSES,
} from '../../constants/index.js';

// ── Phone normalisation ───────────────────────────────────────────────────────
// Converts any Kenyan phone variant to E.164 (+254XXXXXXXXX) for comparison.
function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  if (digits.startsWith('254')) return `+${digits}`;
  return `+${digits}`;
}

// ── M-Pesa SMS parser ─────────────────────────────────────────────────────────
// Handles the standard Safaricom confirmation format:
//   "You have received KES 2500.00 from 0722987654 on 28/1/24 at 2:45 PM.
//    Transaction ID: LIK2A1B2C3D. New balance: KES 50000"
//
// Also handles shorthand variants with "Ksh" instead of "KES".
function parseMpesaSMS(text) {
  const t = text || '';

  // Amount — "KES X" or "Ksh X"
  const amountMatch = t.match(/(?:KES|Ksh)\s+([\d,]+(?:\.\d+)?)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

  // Sender — "from XXXXXXXXXXX"
  const senderMatch = t.match(/from\s+([\d\-]+)/i);
  const senderPhone = senderMatch ? normalisePhone(senderMatch[1]) : null;

  // Transaction ID — uppercase alphanumeric token after "ID:" or "transaction"
  const txnMatch = t.match(/(?:[Tt]ransaction\s+ID:?\s*|ID:\s*)([A-Z0-9]{8,})/);
  const transactionId = txnMatch ? txnMatch[1] : null;

  const ok = !!(amount && amount > 0 && senderPhone && transactionId);
  return { ok, amount, senderPhone, transactionId };
}

// ── Determine active term from settings ──────────────────────────────────────
// Returns { academicYear, term } for the period that includes today, or the
// most recently started term if today is between terms.
function resolveActivePeriod(settings) {
  const today = new Date();
  const year  = settings?.currentAcademicYear ?? String(today.getFullYear());
  const terms = settings?.terms ?? [];

  // Find term whose window contains today
  const active = terms.find(
    (t) => today >= new Date(t.startDate) && today <= new Date(t.endDate)
  );
  if (active) return { academicYear: year, term: active.name };

  // Fall back to the last term that has started
  const started = terms
    .filter((t) => new Date(t.startDate) <= today)
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  if (started.length) return { academicYear: year, term: started[0].name };

  // Default
  return { academicYear: year, term: 'Term 1' };
}

// ── POST /api/v1/sms/inbound ──────────────────────────────────────────────────
// Africa's Talking always sends form-encoded body.
// Fields: from, to, text, date, id
// Must return HTTP 200 quickly to prevent AT retry storms.
export const handleInboundSms = asyncHandler(async (req, res) => {
  // Respond 200 immediately — all failures are logged, never 4xx/5xx to AT
  const { from, to, text, id: messageId } = req.body;

  logger.info('[SMS-INBOUND] Received', { messageId, from, to, textLength: text?.length });

  // Find the school that owns this till number
  const school = await School.findOne({ mpesaTillNumber: normalisePhone(to) })
    .select('_id name');

  if (!school) {
    logger.warn('[SMS-INBOUND] No school matched till number', { to });
    return sendSuccess(res, {});
  }

  // Parse M-Pesa message
  const parsed = parseMpesaSMS(text);
  if (!parsed.ok) {
    logger.warn('[SMS-INBOUND] Could not parse SMS', { schoolId: school._id, text });
    return sendSuccess(res, {});
  }

  const { amount, senderPhone, transactionId } = parsed;

  // Duplicate guard — skip if this txn is already recorded
  const exists = await Payment.findOne({ schoolId: school._id, reference: transactionId });
  if (exists) {
    logger.info('[SMS-INBOUND] Duplicate transaction, skipping', { transactionId });
    return sendSuccess(res, {});
  }

  // Match sender phone to a student's guardian
  const students = await Student.find({
    schoolId: school._id,
    status: STUDENT_STATUSES.ACTIVE,
  }).select('_id classId guardians firstName lastName');

  const student = students.find((s) =>
    s.guardians?.some((g) => normalisePhone(g.phone) === senderPhone)
  );

  if (!student) {
    logger.warn('[SMS-INBOUND] Sender phone not linked to any student', {
      schoolId: school._id, senderPhone,
    });
    // Still return 200 so AT doesn't retry
    return sendSuccess(res, {});
  }

  // Resolve active academic period from school settings
  const settings = await SchoolSettings.findOne({ schoolId: school._id });
  const { academicYear, term } = resolveActivePeriod(settings);

  // Create the payment record
  const payment = await Payment.create({
    schoolId:     school._id,
    studentId:    student._id,
    classId:      student.classId,
    academicYear,
    term,
    amount,
    method:       PAYMENT_METHODS.MPESA,
    reference:    transactionId,
    source:       PAYMENT_SOURCE.SMS_WEBHOOK,
    status:       PAYMENT_STATUSES.COMPLETED,
    paymentDate:  new Date(),
  });

  logger.info('[SMS-INBOUND] Payment created', {
    paymentId: payment._id,
    receiptNumber: payment.receiptNumber,
    student: `${student.firstName} ${student.lastName}`,
    amount,
  });

  // Queue a receipt SMS back to the parent
  const receiptMsg =
    `${school.name}: Payment KES ${amount.toLocaleString()} received for ` +
    `${student.firstName} ${student.lastName}. ` +
    `Receipt: ${payment.receiptNumber}. Thank you.`;

  try {
    await smsQueue.add(JOB_NAMES.SEND_SMS, {
      to:       senderPhone,
      message:  receiptMsg,
      schoolId: school._id.toString(),
      trigger:  SMS_TRIGGER_TYPES.PAYMENT_RECEIPT,
    });
  } catch (err) {
    logger.error('[SMS-INBOUND] Failed to queue receipt SMS', { err: err.message });
  }

  return sendSuccess(res, {});
});
