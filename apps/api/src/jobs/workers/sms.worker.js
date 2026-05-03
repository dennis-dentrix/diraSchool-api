/**
 * SMS Worker — processes jobs from the "sms" queue.
 *
 * Each job payload:
 * {
 *   to:       string | string[]   — E.164 Kenyan phone number(s)
 *   message:  string              — SMS body (max 160 chars per segment)
 *   schoolId: string              — for school sender-ID lookup
 *   trigger:  SMS_TRIGGER_TYPES   — fee_reminder | absence_alert | etc.
 *   smsLogId: string              — SmsLog._id to update on completion
 * }
 *
 * Test mode: when AT_TEST_NUMBERS is set in env, ALL recipients are replaced
 * with those numbers so real users are never messaged during development / QA.
 */
import AfricasTalking from 'africastalking';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import School from '../../features/schools/School.model.js';
import SmsLog from '../../features/sms/SmsLog.model.js';

// Lazy singleton — initialized on first job so env is fully loaded.
let _smsClient = null;
function getClient() {
  if (_smsClient) return _smsClient;
  if (!env.AT_USERNAME || !env.AT_API_KEY) {
    throw new Error('Africa\'s Talking not configured (AT_USERNAME / AT_API_KEY missing).');
  }
  const AT = AfricasTalking({ username: env.AT_USERNAME, apiKey: env.AT_API_KEY });
  _smsClient = AT.SMS;
  return _smsClient;
}

async function updateLog(smsLogId, update) {
  if (!smsLogId) return;
  try {
    await SmsLog.findByIdAndUpdate(smsLogId, update);
  } catch (err) {
    logger.error('[SMS] Failed to update SmsLog', { err: err.message, smsLogId });
  }
}

export const processSmsJob = async (job) => {
  const { to, message, schoolId, trigger, smsLogId } = job.data;

  let rawRecipients = Array.isArray(to) ? to : [to];

  // ── Test-number guard ────────────────────────────────────────────────────────
  // When AT_TEST_NUMBERS is set, redirect ALL messages to the test numbers only.
  // This prevents accidental real sends during development / QA.
  if (env.AT_TEST_NUMBERS && env.AT_TEST_NUMBERS.length > 0) {
    logger.warn('[SMS] TEST MODE — redirecting recipients to test numbers', {
      originalCount: rawRecipients.length,
      testNumbers: env.AT_TEST_NUMBERS,
    });
    rawRecipients = env.AT_TEST_NUMBERS;
  }

  if (rawRecipients.length === 0) {
    logger.warn('[SMS] No recipients after filtering — skipping job', { jobId: job.id });
    await updateLog(smsLogId, { status: 'failed', sentCount: 0, failedCount: 0 });
    return { sent: 0, failed: 0 };
  }

  // ── Sender ID ────────────────────────────────────────────────────────────────
  // Only use a custom sender ID if the school has one explicitly approved by AT.
  // Sending with an unapproved ID causes AT to reject the message outright.
  // Omitting `from` makes AT use the default shortcode assigned to the account.
  let senderId = null;
  try {
    const school = await School.findById(schoolId).select('name smsSettings').lean();
    const approvedId = school?.smsSettings?.senderIdApproved;
    senderId = approvedId || env.AT_SENDER_ID || null;

    if (!approvedId) {
      logger.info('[SMS] No school-level approved sender ID — using account default', {
        schoolId,
        fallback: senderId ?? '(AT account default)',
      });
    }

    logger.info('[SMS] Sending', {
      jobId: job.id,
      trigger,
      schoolId,
      schoolName: school?.name,
      senderId: senderId ?? '(AT default)',
      recipients: rawRecipients.length,
      testMode: !!(env.AT_TEST_NUMBERS?.length),
    });
  } catch (err) {
    logger.warn('[SMS] Could not fetch school for sender ID — using env fallback', {
      err: err.message, schoolId,
    });
    senderId = env.AT_SENDER_ID || null;
  }

  // ── Send via Africa's Talking ─────────────────────────────────────────────────
  let sentCount = 0;
  let failedCount = rawRecipients.length;

  try {
    const sms = getClient();

    const sendParams = {
      to: rawRecipients,
      message,
    };
    // Only attach `from` when we have an approved/configured sender ID.
    // Passing `from: null` or `from: undefined` causes AT SDK to throw.
    if (senderId) sendParams.from = senderId;

    const result = await sms.send(sendParams);

    const recipientResults = result?.SMSMessageData?.Recipients ?? [];

    const failed = recipientResults.filter((r) => r.statusCode !== 101);
    sentCount   = recipientResults.length - failed.length;
    failedCount = failed.length;

    if (failed.length > 0) {
      logger.warn('[SMS] Some recipients failed', {
        jobId: job.id,
        failed: failed.map((r) => ({ number: r.number, status: r.status, statusCode: r.statusCode })),
      });
    }

    logger.info('[SMS] Job completed', { jobId: job.id, sent: sentCount, failed: failedCount });
  } catch (err) {
    logger.error('[SMS] Africa\'s Talking send failed', {
      jobId: job.id,
      err: err.message,
      schoolId,
    });
    // Re-throw so BullMQ can retry the job (3 attempts with exponential backoff)
    await updateLog(smsLogId, { status: 'failed', sentCount: 0, failedCount: rawRecipients.length });
    throw err;
  }

  const status = failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial';
  await updateLog(smsLogId, { status, sentCount, failedCount });

  return { sent: sentCount, failed: failedCount };
};
