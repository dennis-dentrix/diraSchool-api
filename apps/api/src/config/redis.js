import { Redis } from 'ioredis';
import { env } from './env.js';

let redisClient = null;

// ── Shared base options ───────────────────────────────────────────────────────
// Used by BOTH the main app client and BullMQ connections.
// Additional per-client options are layered on top below.

const buildBaseOptions = () => {
  const isTLS = env.REDIS_URL?.startsWith('rediss://');
  return {
    // Upstash closes idle connections after ~10 s — keepAlive prevents the loop
    keepAlive: 5000,
    // Force IPv4. family:0 (dual-stack) causes slow DNS on some Railway regions.
    family: 4,
    // TLS is required for rediss:// (Upstash always needs this)
    tls: isTLS ? { rejectUnauthorized: false } : undefined,
    // Reconnect backoff: 200 ms → 400 ms → … → 2 s cap
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
    connectTimeout: 10_000,
  };
};

// ── Main app client ───────────────────────────────────────────────────────────
/**
 * The Redis client used by the application for caching and rate-limiting.
 *
 * Deliberately does NOT set:
 *   - maxRetriesPerRequest: null  → would make commands queue forever; 3 s
 *                                   commandTimeout would then fire → "degraded"
 *   - enableReadyCheck: false     → required by BullMQ, but wrong for the main
 *                                   client; without it, commands fire before
 *                                   Upstash finishes TLS auth → ECONNRESET
 *
 * Uses ioredis defaults:
 *   - maxRetriesPerRequest: 20    → fail fast if the connection is broken
 *   - enableReadyCheck: true      → wait for server READY before sending commands
 */
export const connectRedis = () => {
  redisClient = new Redis(env.REDIS_URL, {
    ...buildBaseOptions(),
    commandTimeout: 3_000,  // health-check ping fails fast — no 5-second hangs
  });

  redisClient.on('connect',      () => console.log('[Redis] TCP connected'));
  redisClient.on('ready',        () => console.log('[Redis] Ready — auth complete'));
  redisClient.on('reconnecting', (t) => console.warn(`[Redis] Reconnecting in ${t} ms…`));
  redisClient.on('error',        (err) => console.error(`[Redis] Error: ${err.message}`));
  redisClient.on('close',        () => console.warn('[Redis] Connection closed'));

  return redisClient;
};

// ── BullMQ connection factory ─────────────────────────────────────────────────
/**
 * Creates a dedicated ioredis instance for BullMQ Queues and Workers.
 *
 * BullMQ REQUIRES:
 *   - maxRetriesPerRequest: null  → queue commands while reconnecting (never throw)
 *   - enableReadyCheck: false     → BullMQ manages its own readiness protocol
 *
 * IMPORTANT: Must be called with new Redis(url, options) — NOT { url, ...options }.
 * ioredis only parses URLs when the string is the first constructor argument.
 * Passing { url: '...' } in the options object silently connects to localhost:6379.
 *
 * BullMQ calls connection.duplicate() internally for each Queue/Worker, so each
 * gets its own isolated connection without sharing blocking-command channels.
 */
export const createBullMQConnection = () =>
  new Redis(env.REDIS_URL, {
    ...buildBaseOptions(),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

// ── Client accessor ───────────────────────────────────────────────────────────
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
