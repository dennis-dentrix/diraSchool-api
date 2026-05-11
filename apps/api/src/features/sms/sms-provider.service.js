import AfricasTalking from 'africastalking';
import { env } from '../../config/env.js';
import { sendViaCelcom } from './celcom.service.js';

export const SMS_PROVIDERS = {
  CELCOM: 'celcom',
  AFRICAS_TALKING: 'africastalking',
};

let atClient = null;

function configuredProvider() {
  return Object.values(SMS_PROVIDERS).includes(env.SMS_PROVIDER)
    ? env.SMS_PROVIDER
    : SMS_PROVIDERS.CELCOM;
}

function getAfricasTalkingClient() {
  if (atClient) return atClient;
  if (!env.AT_USERNAME || !env.AT_API_KEY) {
    throw new Error("Africa's Talking not configured (AT_USERNAME / AT_API_KEY missing).");
  }
  const AT = AfricasTalking({ username: env.AT_USERNAME, apiKey: env.AT_API_KEY });
  atClient = AT.SMS;
  return atClient;
}

export function smsProviderConfigured() {
  if (configuredProvider() === SMS_PROVIDERS.CELCOM) {
    return !!(env.CELCOM_API_KEY && env.CELCOM_PARTNER_ID);
  }
  return !!(env.AT_USERNAME && env.AT_API_KEY);
}

export function smsProviderName() {
  return configuredProvider();
}

export function smsProviderConfigSummary() {
  const provider = configuredProvider();
  return {
    provider,
    configured: smsProviderConfigured(),
    senderId: env.SMS_PLATFORM_SENDER_ID || env.CELCOM_SHORTCODE || env.AT_SENDER_ID || null,
    testMode: !!(env.SMS_TEST_NUMBERS?.length),
    testNumbers: env.SMS_TEST_NUMBERS ?? null,
  };
}

export async function sendViaConfiguredSmsProvider({ recipients, message, senderId }) {
  const provider = configuredProvider();

  if (provider === SMS_PROVIDERS.CELCOM) {
    const result = await sendViaCelcom({ recipients, message, senderId });
    return { provider, ...result };
  }

  const sms = getAfricasTalkingClient();
  const recipientList = Array.isArray(recipients) ? recipients : [recipients];
  const params = { to: recipientList, message };
  if (senderId) params.from = senderId;

  const result = await sms.send(params);
  const atRecipients = result?.SMSMessageData?.Recipients ?? [];
  return {
    provider,
    raw: result,
    sent: atRecipients.filter((item) => item.statusCode === 101).length,
    failed: atRecipients.filter((item) => item.statusCode !== 101).length,
    recipients: atRecipients.map((item) => ({
      number: item.number,
      messageId: item.messageId ?? null,
      statusCode: item.statusCode,
      status: item.status,
      raw: item,
    })),
  };
}
