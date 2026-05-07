import { env } from '../../config/env.js';
import logger from '../../config/logger.js';

const CELCOM_ENDPOINT = 'https://isms.celcomafrica.com/api/services/sendsms/';

/**
 * Send SMS via Celcom Africa.
 * Accepts a list of E.164 recipients; Celcom handles bulk via comma-separated mobile param.
 */
export async function sendViaCelcom({ recipients, message, senderId }) {
  if (!env.CELCOM_API_KEY || !env.CELCOM_PARTNER_ID) {
    throw new Error('Celcom Africa not configured (CELCOM_API_KEY / CELCOM_PARTNER_ID missing).');
  }

  const mobile = Array.isArray(recipients) ? recipients.join(',') : String(recipients);
  const shortcode = senderId || env.CELCOM_SHORTCODE || '';

  const params = new URLSearchParams({
    apikey: env.CELCOM_API_KEY,
    partnerID: env.CELCOM_PARTNER_ID,
    message,
    shortcode,
    mobile,
  });

  const response = await fetch(`${CELCOM_ENDPOINT}?${params.toString()}`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Celcom HTTP ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();
  logger.debug('[SMS-CELCOM] Raw response', { json });

  // Celcom uses "respose-code" (their typo). 200 = accepted.
  const code = json['respose-code'];
  if (code !== 200 && code !== '200') {
    throw new Error(
      `Celcom send failed: ${json['response-description'] ?? 'Unknown error'} (code ${code})`
    );
  }

  return {
    sent: Array.isArray(recipients) ? recipients.length : 1,
    failed: 0,
    messageId: json.messageid ?? null,
  };
}
