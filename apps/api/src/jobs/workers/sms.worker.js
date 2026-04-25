/**
 * SMS Worker — processes jobs from the "sms" queue.
 *
 * Each job payload:
 * {
 *   to:       string | string[]   — E.164 Kenyan phone number(s)
 *   message:  string              — SMS body (max 160 chars per segment)
 *   schoolId: string              — for audit logging
 *   trigger:  SMS_TRIGGER_TYPES   — fee_reminder | absence_alert | etc.
 * }
 *
 * Sender ID: Uses school's approved sender ID if available, falls back to default.
 */
import AfricasTalking from 'africastalking';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';
import { SMS_TRIGGER_TYPES } from '../../constants/index.js';
import School from '../../features/schools/School.model.js';

const AT = AfricasTalking({
  username: env.AT_USERNAME,
  apiKey: env.AT_API_KEY,
});
const sms = AT.SMS;

export const processSmsJob = async (job) => {
  const { to, message, schoolId, trigger } = job.data;

  const recipients = Array.isArray(to) ? to : [to];

  // Fetch school's SMS settings to get approved sender ID
  const school = await School.findById(schoolId).select('name smsSettings');
  const senderIdApproved = school?.smsSettings?.senderIdApproved;
  const senderId = senderIdApproved || env.AT_SENDER_ID || 'SCHOOL';

  logger.info('[SMS] Sending', {
    jobId: job.id,
    trigger,
    schoolId,
    schoolName: school?.name,
    senderId,
    recipients: recipients.length,
  });

  const result = await sms.send({
    to: recipients,
    message,
    from: senderId,
  });

  const recipients_result = result.SMSMessageData?.Recipients ?? [];
  const failed = recipients_result.filter((r) => r.statusCode !== 101);

  if (failed.length > 0) {
    logger.warn('[SMS] Some recipients failed', {
      jobId: job.id,
      failed: failed.map((r) => ({ number: r.number, status: r.status })),
    });
  }

  logger.info('[SMS] Job completed', {
    jobId: job.id,
    sent: recipients_result.length - failed.length,
    failed: failed.length,
  });

  return { sent: recipients_result.length - failed.length, failed: failed.length };
};
