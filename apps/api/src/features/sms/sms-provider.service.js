import AfricasTalking from 'africastalking';
import { env } from '../../config/env.js';

let atClient = null;

function getAtClient() {
  if (atClient) return atClient;
  if (!env.AT_USERNAME || !env.AT_API_KEY) {
    throw new Error("Africa's Talking not configured — set AT_USERNAME and AT_API_KEY.");
  }
  const AT = AfricasTalking({ username: env.AT_USERNAME, apiKey: env.AT_API_KEY });
  atClient = AT.SMS;
  return atClient;
}

// E.164 format required by Africa's Talking (+254XXXXXXXXX)
const toE164 = (phone) => {
  const raw = String(phone ?? '').trim().replace(/\s+/g, '');
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('254')) return `+${raw}`;
  if (raw.startsWith('0') && raw.length === 10) return `+254${raw.slice(1)}`;
  return raw;
};

export function smsProviderConfigured() {
  return !!(env.AT_USERNAME && env.AT_API_KEY);
}

export function smsProviderName() {
  return 'africastalking';
}

export function smsProviderConfigSummary() {
  return {
    provider: 'africastalking',
    configured: smsProviderConfigured(),
    senderId: env.AT_SENDER_ID || null,
    testMode: !!(env.SMS_TEST_NUMBERS?.length),
    testNumbers: env.SMS_TEST_NUMBERS ?? null,
  };
}

/**
 * Send SMS via Africa's Talking.
 * recipients: string | string[]  — Kenyan phone numbers in any format (07x, 254x, +254x)
 * message:    string
 * senderId:   string | null      — approved AT sender ID; omit for shortcode
 */
export async function sendViaConfiguredSmsProvider({ recipients, message, senderId }) {
  const sms = getAtClient();

  const recipientList = (Array.isArray(recipients) ? recipients : [recipients])
    .map(toE164)
    .filter(Boolean);

  if (!recipientList.length) {
    return { provider: 'africastalking', sent: 0, failed: 0, recipients: [] };
  }

  const params = { to: recipientList, message };
  const from = senderId || env.AT_SENDER_ID;
  if (from) params.from = from;

  const result = await sms.send(params);
  const atRecipients = result?.SMSMessageData?.Recipients ?? [];

  return {
    provider: 'africastalking',
    raw: result,
    sent: atRecipients.filter((r) => r.statusCode === 101).length,
    failed: atRecipients.filter((r) => r.statusCode !== 101).length,
    recipients: atRecipients.map((r) => ({
      number: r.number,
      messageId: r.messageId ?? null,
      statusCode: r.statusCode,
      status: r.status,
      raw: r,
    })),
  };
}
