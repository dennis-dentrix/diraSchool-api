import { env } from '../../config/env.js';

const DEFAULT_BASE_URLS = {
  sandbox: 'https://cybqa.pesapal.com/pesapalv3',
  live: 'https://pay.pesapal.com/v3',
};

const getBaseUrl = () => {
  if (env.PESAPAL_BASE_URL) return env.PESAPAL_BASE_URL.replace(/\/+$/, '');
  return DEFAULT_BASE_URLS[env.PESAPAL_ENV] ?? DEFAULT_BASE_URLS.sandbox;
};

const ensureConfigured = () => {
  if (!env.PESAPAL_ENABLED) {
    throw new Error('Pesapal is not enabled.');
  }
  if (!env.PESAPAL_CONSUMER_KEY || !env.PESAPAL_CONSUMER_SECRET) {
    throw new Error('Missing Pesapal credentials in environment variables.');
  }
  if (!env.PESAPAL_NOTIFICATION_ID) {
    throw new Error('Missing PESAPAL_NOTIFICATION_ID in environment variables.');
  }
};

const parseJson = async (res) => {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const request = async (path, { method = 'GET', token, body } = {}) => {
  const url = `${getBaseUrl()}${path}`;
  const headers = { Accept: 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await parseJson(res);
  if (!res.ok) {
    const msg = data?.message || data?.error || data?.error_description || `Pesapal request failed (${res.status})`;
    const err = new Error(msg);
    err.statusCode = res.status;
    err.payload = data;
    throw err;
  }
  return data;
};

export const getPesapalToken = async () => {
  ensureConfigured();
  const data = await request('/api/Auth/RequestToken', {
    method: 'POST',
    body: {
      consumer_key: env.PESAPAL_CONSUMER_KEY,
      consumer_secret: env.PESAPAL_CONSUMER_SECRET,
    },
  });

  const token = data?.token;
  if (!token) throw new Error('Pesapal token was not returned.');
  return token;
};

export const submitPesapalOrder = async (orderPayload) => {
  const token = await getPesapalToken();
  return request('/api/Transactions/SubmitOrderRequest', {
    method: 'POST',
    token,
    body: orderPayload,
  });
};

export const getPesapalTransactionStatus = async (orderTrackingId) => {
  const token = await getPesapalToken();
  const encoded = encodeURIComponent(orderTrackingId);
  return request(`/api/Transactions/GetTransactionStatus?orderTrackingId=${encoded}`, {
    token,
  });
};
