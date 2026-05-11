/**
 * SMS Worker — processes jobs from the "sms" queue.
 *
 * Job payload:
 * {
 *   to:           string | string[]   — E.164 Kenyan phone number(s)
 *   message:      string
 *   schoolId:     string
 *   trigger:      SMS_TRIGGER_TYPES
 *   smsLogId:     string              — SmsLog._id to update on completion
 *   term?:        string              — override current term (optional)
 *   academicYear?: string
 * }
 *
 * Cap rule: 5 SMS per parent phone per term (included). Sends beyond the cap
 * deduct from the school's purchasedRemaining credit balance atomically.
 * Phones that are capped with no purchased credits are skipped (status: capped).
 *
 * Test mode: SMS_TEST_NUMBERS redirects all sends to those numbers.
 */
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import School from '../../features/schools/School.model.js';
import SmsLog from '../../features/sms/SmsLog.model.js';
import SmsDelivery from '../../features/sms/SmsDelivery.model.js';
import {
  sendViaConfiguredSmsProvider,
  smsProviderConfigured,
  smsProviderName,
} from '../../features/sms/sms-provider.service.js';
import {
  SMS_CAP_PER_PARENT_PER_TERM,
  SMS_DELIVERY_STATUS,
  SMS_CREDIT_TYPE,
} from '../../constants/index.js';
import { getCurrentTermAndYear } from '../../utils/term.js';

async function updateLog(smsLogId, update) {
  if (!smsLogId) return;
  try {
    await SmsLog.findByIdAndUpdate(smsLogId, update);
  } catch (err) {
    logger.error('[SMS] Failed to update SmsLog', { err: err.message, smsLogId });
  }
}

/**
 * For each phone, count non-capped SmsDelivery records in the current term.
 * Returns a Map<phone, count>.
 */
async function getTermCounts(schoolId, phones, term, academicYear) {
  const rows = await SmsDelivery.aggregate([
    {
      $match: {
        schoolId: schoolId,
        phone: { $in: phones },
        term,
        academicYear,
        deliveryStatus: { $ne: SMS_DELIVERY_STATUS.CAPPED },
      },
    },
    { $group: { _id: '$phone', count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const r of rows) map.set(r._id, r.count);
  return map;
}

/**
 * Atomically deduct `n` purchased credits from the school.
 * Returns true if deduction succeeded, false if insufficient credits.
 */
async function deductCredits(schoolId, n) {
  const updated = await School.findOneAndUpdate(
    { _id: schoolId, 'smsCredits.purchasedRemaining': { $gte: n } },
    { $inc: { 'smsCredits.purchasedRemaining': -n } },
    { new: true }
  );
  return !!updated;
}

const normaliseText = (value) =>
  String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

function addSchoolNameIfNeeded(message, schoolName) {
  const safeMessage = String(message ?? '').trim();
  const safeSchoolName = String(schoolName ?? '').trim();
  if (!safeSchoolName) return safeMessage;

  const lowerMessage = normaliseText(safeMessage);
  const lowerSchool = normaliseText(safeSchoolName);
  if (lowerMessage.includes(lowerSchool)) return safeMessage;

  return `${safeSchoolName}: ${safeMessage}`;
}

export const processSmsJob = async (job) => {
  const { to, message, schoolId, trigger, smsLogId, term: jobTerm, academicYear: jobYear } = job.data;

  if (!smsProviderConfigured()) {
    await updateLog(smsLogId, { status: 'failed' });
    throw new Error(`SMS provider not configured: ${smsProviderName()}.`);
  }

  const { term, academicYear } = jobTerm
    ? { term: jobTerm, academicYear: jobYear }
    : getCurrentTermAndYear();

  let allRecipients = Array.isArray(to) ? to : [to];

  // ── Test-number redirect ────────────────────────────────────────────────────
  if (env.SMS_TEST_NUMBERS?.length) {
    logger.warn('[SMS] TEST MODE — redirecting to test numbers', {
      originalCount: allRecipients.length, testNumbers: env.SMS_TEST_NUMBERS,
    });
    allRecipients = env.SMS_TEST_NUMBERS;
  }

  if (allRecipients.length === 0) {
    await updateLog(smsLogId, { status: 'failed', sentCount: 0, failedCount: 0 });
    return { sent: 0, failed: 0, capped: 0 };
  }

  // ── Sender ID and school attribution ────────────────────────────────────────
  let senderId = env.SMS_PLATFORM_SENDER_ID || null;
  let schoolName = 'Your school';
  let hasSchoolSenderId = false;

  try {
    const school = await School.findById(schoolId).select('name smsSettings smsCredits').lean();
    schoolName = school?.name ?? schoolName;
    if (school?.smsSettings?.senderIdApproved) {
      senderId = school.smsSettings.senderIdApproved;
      hasSchoolSenderId = true;
    }
  } catch (err) {
    logger.warn('[SMS] Could not fetch school sender ID', { err: err.message, schoolId });
  }

  const outboundMessage = hasSchoolSenderId
    ? message
    : addSchoolNameIfNeeded(message, schoolName);

  // ── Per-parent term cap ───────────────────────────────────────────────────
  const schoolObjId = (await import('mongoose')).default.Types.ObjectId.createFromHexString
    ? (await import('mongoose')).default.Types.ObjectId.createFromHexString(schoolId)
    : new (await import('mongoose')).default.Types.ObjectId(schoolId);

  const counts = await getTermCounts(schoolObjId, allRecipients, term, academicYear);

  const withinCap = [];
  const overCap   = [];
  for (const phone of allRecipients) {
    const used = counts.get(phone) ?? 0;
    if (used < SMS_CAP_PER_PARENT_PER_TERM) withinCap.push(phone);
    else overCap.push(phone);
  }

  // For phones over the cap, deduct one purchased credit each
  let purchasedAllowed = [];
  let capped = [];
  if (overCap.length > 0) {
    const ok = await deductCredits(schoolId, overCap.length);
    if (ok) {
      purchasedAllowed = overCap;
    } else {
      // Insufficient credits — try deducting however many are available
      const school = await School.findById(schoolId).select('smsCredits').lean();
      const available = school?.smsCredits?.purchasedRemaining ?? 0;
      if (available > 0) {
        await deductCredits(schoolId, available);
        purchasedAllowed = overCap.slice(0, available);
        capped = overCap.slice(available);
      } else {
        capped = overCap;
      }
    }
  }

  const toSend = [...withinCap, ...purchasedAllowed];

  // Record capped phones immediately
  if (capped.length > 0) {
    await SmsDelivery.insertMany(
      capped.map((phone) => ({
        schoolId: schoolObjId,
        smsLogId,
        phone,
        trigger,
        term,
        academicYear,
        creditType: SMS_CREDIT_TYPE.PURCHASED,
        deliveryStatus: SMS_DELIVERY_STATUS.CAPPED,
      })),
      { ordered: false }
    );
  }

  if (toSend.length === 0) {
    await updateLog(smsLogId, {
      status: 'failed',
      sentCount: 0,
      failedCount: 0,
      cappedCount: capped.length,
      term,
      academicYear,
    });
    logger.warn('[SMS] All recipients capped, nothing sent', { jobId: job.id, schoolId });
    return { sent: 0, failed: 0, capped: capped.length };
  }

  // ── Send through configured SMS provider ─────────────────────────────────
  let providerResults = [];
  let providerName = smsProviderName();
  try {
    const result = await sendViaConfiguredSmsProvider({
      recipients: toSend,
      message: outboundMessage,
      senderId,
    });
    providerName = result.provider;
    providerResults = result.recipients ?? [];
  } catch (err) {
    logger.error('[SMS] Provider send failed', {
      jobId: job.id, provider: providerName, err: err.message, schoolId,
    });
    await updateLog(smsLogId, {
      status: 'failed', sentCount: 0, failedCount: toSend.length,
      cappedCount: capped.length, term, academicYear,
    });
    throw err;
  }

  // ── Persist SmsDelivery per recipient ────────────────────────────────────
  const deliveryDocs = providerResults.map((r) => {
    const success = r.statusCode === 101 || r.statusCode === 200;
    const phone = toSend.find((p) => p === r.number) ?? r.number;
    return {
      schoolId: schoolObjId,
      smsLogId,
      phone,
      messageId: r.messageId ?? null,
      trigger,
      term,
      academicYear,
      creditType: purchasedAllowed.includes(phone)
        ? SMS_CREDIT_TYPE.PURCHASED
        : SMS_CREDIT_TYPE.INCLUDED,
      deliveryStatus: success ? SMS_DELIVERY_STATUS.SENT : SMS_DELIVERY_STATUS.FAILED,
      failureReason: success ? undefined : r.status,
    };
  });

  if (deliveryDocs.length > 0) {
    await SmsDelivery.insertMany(deliveryDocs, { ordered: false });
  }

  const sentCount = providerResults.filter((r) => r.statusCode === 101 || r.statusCode === 200).length;
  const failedCount = providerResults.length - sentCount;

  if (failedCount > 0) {
    logger.warn('[SMS] Some recipients failed at provider', {
      jobId: job.id,
      provider: providerName,
      failed: providerResults
        .filter((r) => r.statusCode !== 101 && r.statusCode !== 200)
        .map((r) => ({ number: r.number, status: r.status })),
    });
  }

  const status = failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial';
  await updateLog(smsLogId, { status, sentCount, failedCount, cappedCount: capped.length, term, academicYear });

  logger.info('[SMS] Job completed', {
    jobId: job.id, provider: providerName, sent: sentCount, failed: failedCount, capped: capped.length,
  });

  return { sent: sentCount, failed: failedCount, capped: capped.length };
};
