import { Redis } from 'ioredis';
import { env } from './env.js';

let redisClient = null;

/**
 * Builds a shared ioredis options object from the REDIS_URL.
 * Works with:
 *   redis://   — local Docker / plain Redis
 *   rediss://  — Upstash, Redis Cloud, DO Managed Redis (TLS)
 */
export const buildRedisOptions = () => {
  const isTLS = env.REDIS_URL?.startsWith('rediss://');

  return {
    // Upstash closes idle connections — keepAlive prevents the reconnect loop
    keepAlive: 5000,
    // Support both IPv4 and IPv6 (required for Upstash)
    family: 0,
    // TLS for rediss:// URLs
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
    // Sane reconnect backoff — 200ms → 400ms → ... → 2s max
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
    connectTimeout: 10_000,
    commandTimeout: 5_000,
  };
};

/**
 * Creates a dedicated ioredis instance for BullMQ.
 *
 * IMPORTANT: Must use new Redis(url, options) — NOT { url: '...', ...options }.
 * ioredis only parses URLs when the string is passed as the first constructor
 * argument. Passing { url: '...' } as options silently ignores the URL and
 * connects to localhost:6379 instead.
 *
 * BullMQ calls duplicate() on this instance internally for blocking commands,
 * so each Queue/Worker gets its own connection automatically.
 */
export const createBullMQConnection = () =>
  new Redis(env.REDIS_URL, {
    ...buildRedisOptions(),
    maxRetriesPerRequest: null,  // required by BullMQ
    enableReadyCheck: false,     // required by BullMQ
  });

export const connectRedis = () => {
  redisClient = new Redis(env.REDIS_URL, {
    ...buildRedisOptions(),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redisClient.on('connect',      () => console.log('[Redis] Connected'));
  redisClient.on('reconnecting', () => console.log('[Redis] Reconnecting...'));
  redisClient.on('error',        (err) => console.error(`[Redis] Error: ${err.message}`));

  return redisClient;
};

export const getRedis = () => {
  if (!redisClient) {
    if (process.env.NODE_ENV === 'test') return null;
    throw new Error('Redis client not initialised. Call connectRedis() first.');
  }
  return redisClient;
};

// ── Cache helpers ─────────────────────────────────────────────────────────────

export const cacheGet = async (key) => {
  const value = await getRedis().get(key);
  return value ? JSON.parse(value) : null;
};

export const cacheSet = async (key, value, ttlSeconds) => {
  await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

export const cacheDel = async (key) => {
  await getRedis().del(key);
};

export const cacheDelPattern = async (pattern) => {
  const keys = await getRedis().keys(pattern);
  if (keys.length > 0) await getRedis().del(...keys);
};
