import { env } from '../../config/env.js';

const BASE_URL = 'https://api.paystack.co';

const request = async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok || !data.status) {
    const err = new Error(data.message || `Paystack request failed (${res.status})`);
    err.statusCode = res.status;
    err.payload = data;
    throw err;
  }

  return data.data;
};

/**
 * Initialize a Paystack transaction.
 * Amount must be in the smallest currency unit (KES cents — multiply KES by 100).
 */
export const initializeTransaction = ({ email, amount, reference, callbackUrl, metadata = {} }) =>
  request('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: Math.round(amount * 100), // KES → cents
      reference,
      callback_url: callbackUrl,
      currency: 'KES',
      metadata,
    },
  });

/**
 * Verify a Paystack transaction by reference.
 * Call this after the webhook or callback to confirm payment.
 */
export const verifyTransaction = (reference) =>
  request(`/transaction/verify/${encodeURIComponent(reference)}`);
