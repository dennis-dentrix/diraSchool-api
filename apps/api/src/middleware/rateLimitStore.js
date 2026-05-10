import { MemoryStore } from 'express-rate-limit';
import { getRedis } from '../config/redis.js';

/**
 * Redis-backed store for express-rate-limit.
 *
 * The built-in MemoryStore only works per Node process. PM2 cluster mode runs
 * several API workers, so counters must live in Redis to be enforced globally.
 */
export class RedisRateLimitStore {
  constructor({ prefix }) {
    this.prefix = prefix;
    this.localKeys = false;
    this.windowMs = 60_000;
    this.fallback = new MemoryStore();
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  key(key) {
    return `${this.prefix}:${key}`;
  }

  redis() {
    try {
      return getRedis();
    } catch {
      return null;
    }
  }

  async get(key) {
    const redis = this.redis();
    if (!redis) return this.fallback.get(key);

    const redisKey = this.key(key);
    let value;
    let ttl;

    try {
      [value, ttl] = await Promise.all([
        redis.get(redisKey),
        redis.pttl(redisKey),
      ]);
    } catch {
      return this.fallback.get(key);
    }

    if (!value || ttl < 0) return undefined;

    return {
      totalHits: Number(value),
      resetTime: new Date(Date.now() + ttl),
    };
  }

  async increment(key) {
    const redis = this.redis();
    if (!redis) return this.fallback.increment(key);

    const redisKey = this.key(key);
    let totalHits;
    let ttl;

    try {
      totalHits = await redis.incr(redisKey);
      ttl = await redis.pttl(redisKey);

      if (totalHits === 1 || ttl < 0) {
        await redis.pexpire(redisKey, this.windowMs);
        ttl = this.windowMs;
      }
    } catch {
      return this.fallback.increment(key);
    }

    return {
      totalHits,
      resetTime: new Date(Date.now() + ttl),
    };
  }

  async decrement(key) {
    const redis = this.redis();
    if (!redis) return this.fallback.decrement(key);

    const redisKey = this.key(key);
    try {
      const current = Number(await redis.get(redisKey));
      if (current > 0) await redis.decr(redisKey);
    } catch {
      await this.fallback.decrement(key);
    }
  }

  async resetKey(key) {
    const redis = this.redis();
    if (!redis) return this.fallback.resetKey(key);

    try {
      await redis.del(this.key(key));
    } catch {
      await this.fallback.resetKey(key);
    }
  }
}
