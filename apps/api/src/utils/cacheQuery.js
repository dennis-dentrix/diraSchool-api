/**
 * Cache query results in Redis to dramatically improve API response times.
 * Automatically handles cache invalidation on mutations.
 *
 * Usage:
 *   const students = await cacheQuery('students:class:' + classId, () =>
 *     Student.find({ classId }).lean()
 *   );
 */

import { getRedis, cacheGet, cacheSet } from '../config/redis.js';

/**
 * Execute a query and cache the result in Redis.
 * @param {string} key - Cache key (e.g., 'students:class:123')
 * @param {Function} queryFn - Async function that returns data
 * @param {number} ttl - Time to live in seconds (default: 5 minutes)
 * @returns {Promise<any>} Cached or fresh data
 */
export async function cacheQuery(key, queryFn, ttl = 5 * 60) {
  try {
    // Try to get from cache first
    const cached = await cacheGet(key);
    if (cached) return cached;
  } catch {
    // Redis unavailable — proceed with query
  }

  // Cache miss or Redis down — execute query
  const result = await queryFn();

  // Try to cache the result
  try {
    await cacheSet(key, result, ttl);
  } catch {
    // Non-fatal if caching fails
  }

  return result;
}

/**
 * Invalidate cache keys that match a pattern.
 * Useful after mutations (create, update, delete).
 *
 * Usage:
 *   await invalidateCache('students:*');
 *   await invalidateCache(`students:class:${classId}`);
 */
export async function invalidateCache(pattern) {
  try {
    const redis = getRedis();
    if (!redis) return;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err) {
    // Non-fatal if invalidation fails
    console.warn(`[Cache] Invalidation failed for pattern ${pattern}:`, err.message);
  }
}

/**
 * Invalidate multiple patterns at once.
 * Usage:
 *   await invalidateMultiple(['students:*', 'classes:*']);
 */
export async function invalidateMultiple(patterns) {
  await Promise.all(patterns.map(p => invalidateCache(p)));
}
