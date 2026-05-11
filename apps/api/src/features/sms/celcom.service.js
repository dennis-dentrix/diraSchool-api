import { env } from '../../config/env.js';
import logger from '../../config/logger.js';

const ensureArray = (value) => Array.isArray(value) ? value : [value];

const celcomMobile = (phone) => String(phone ?? '').trim().replace(/^\+/, '');
const e164Mobile = (phone) => {
  const raw = String(phone ?? '').trim();
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('254')) return `+${raw}`;
  if (raw.startsWith('0')) return `+254${raw.slice(1)}`;
  return raw;
};

/**
 * Send SMS via Celcom Africa.
 * Accepts a list of E.164 recipients; Celcom accepts bulk via comma-separated mobile.
 */
export async function sendViaCelcom({ recipients, message, senderId }) {
  if (!env.CELCOM_API_KEY || !env.CELCOM_PARTNER_ID) {
    throw new Error('Celcom Africa not configured (CELCOM_API_KEY / CELCOM_PARTNER_ID missing).');
  }

  const recipientList = ensureArray(recipients).map(e164Mobile).filter(Boolean);
  if (!recipientList.length) return { recipients: [], raw: null };

  const shortcode = senderId || env.CELCOM_SHORTCODE || env.SMS_PLATFORM_SENDER_ID;
  if (!shortcode) {
    throw new Error('Celcom Africa sender ID/shortcode missing (CELCOM_SHORTCODE or SMS_PLATFORM_SENDER_ID).');
  }

  const payload = {
    apikey: env.CELCOM_API_KEY,
    partnerID: env.CELCOM_PARTNER_ID,
    message,
    shortcode,
    mobile: recipientList.map(celcomMobile).join(','),
    pass_type: 'plain',
  };

  const response = await fetch(env.CELCOM_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Celcom HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  logger.debug('[SMS-CELCOM] Raw response', { json });

  const responses = Array.isArray(json.responses)
    ? json.responses
    : (json['respose-code'] || json['response-code'] ? [json] : []);

  if (!responses.length) throw new Error('Celcom send failed: unexpected response shape.');

  const mapped = responses.map((item, index) => {
    const code = item['respose-code'] ?? item['response-code'] ?? item.code;
    const phone = e164Mobile(item.mobile ?? recipientList[index]);
    return {
      number: phone,
      messageId: item.messageid ?? item.messageId ?? item.message_id ?? null,
      statusCode: Number(code),
      status: item['response-description'] ?? item.description ?? String(code ?? 'unknown'),
      raw: item,
    };
  });

  const failed = mapped.filter((item) => item.statusCode !== 200);
  if (failed.length === mapped.length) {
    const first = failed[0];
    throw new Error(`Celcom send failed: ${first.status} (code ${first.statusCode})`);
  }

  return {
    sent: mapped.filter((item) => item.statusCode === 200).length,
    failed: failed.length,
    recipients: mapped,
    raw: json,
  };
}
