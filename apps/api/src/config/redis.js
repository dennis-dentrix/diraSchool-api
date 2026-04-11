import { Redis } from 'ioredis';
import { env } from './env.js';

let redisClient = null;

export const connectRedis = () => {
  redisClient = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,    // Required for BullMQ
    lazyConnect: false,
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected');
  });

  redisClient.on('error', (err) => {
    console.error(`[Redis] Error: ${err.message}`);
  });

  redisClient.on('reconnecting', () => {
    console.warn('[Redis] Reconnecting...');
  });

  return redisClient;
};

export const getRedis = () => {
  if (!redisClient) {
    // In test environment Redis isn't started — callers must handle null
    if (process.env.NODE_ENV === 'test') return null;
    throw new Error('Redis client not initialised. Call connectRedis() first.');
  }
  return redisClient;
};

// Cache helpers

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
  if (keys.length > 0) {
    await getRedis().del(...keys);
  }
};
