import jwt from 'jsonwebtoken';
import User from '../features/users/User.model.js';
import School from '../features/schools/School.model.js';
import { env } from '../config/env.js';
import { SUBSCRIPTION_STATUSES, CACHE_TTL } from '../constants/index.js';
import { sendUnauthorized, sendForbidden } from '../utils/response.js';
import { getRedis } from '../config/redis.js';
import { attachAutoAudit } from '../utils/auditLogger.js';

// ── Per-school rate limit ─────────────────────────────────────────────────────
// Limits each school tenant to SCHOOL_RATE_LIMIT requests per 60-second window.
// Implemented with a Redis INCR + TTL counter — zero DB load.
// Gracefully no-ops when Redis is unavailable (non-fatal).

const SCHOOL_RATE_LIMIT = parseInt(process.env.SCHOOL_RATE_LIMIT, 10) || 300; // req / min

const checkSchoolRateLimit = async (schoolId) => {
  const redis = getRedis();
  if (!redis) return false; // Redis not available in test env — skip limiting

  // Key rotates every 60 seconds: one counter per school per minute
  const window = Math.floor(Date.now() / 60_000);
  const key = `rate:school:${schoolId}:${window}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First request in this window — set expiry so old keys self-clean
      await redis.expire(key, 90); // 90 s > 60 s to handle clock edge cases
    }
    return count > SCHOOL_RATE_LIMIT;
  } catch {
    return false; // Redis hiccup — allow the request through (fail open)
  }
};

/**
 * protect — verifies JWT, loads user, checks school subscription.
 * Must be the FIRST middleware on every protected route.
 */
export const protect = async (req, res, next) => {
  // Read token from HTTP-only cookie
  const token = req.cookies?.token;

  if (!token) {
    return sendUnauthorized(res, 'Not authenticated. Please log in.');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return sendUnauthorized(res, 'Invalid or expired token. Please log in again.');
  }

  // Load user — exclude password
  const user = await User.findById(decoded.id).select('-password');

  if (!user) {
    return sendUnauthorized(res, 'User no longer exists.');
  }

  if (!user.isActive) {
    return sendForbidden(res, 'Your account has been deactivated. Contact your administrator.');
  }

  // Check school subscription (skip for superadmin — they have no schoolId)
  if (user.schoolId) {
    const cacheKey = `school:sub:${user.schoolId}`;
    let schoolData = null;

    // Try Redis cache first (null-safe: getRedis() returns null in test env)
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) schoolData = JSON.parse(cached);
      } catch {
        // cache miss or Redis hiccup — fall through to DB
      }
    }

    if (!schoolData) {
      const school = await School.findById(user.schoolId).select(
        'isActive subscriptionStatus trialExpiry planTier'
      );
      if (school) {
        schoolData = {
          isActive: school.isActive,
          subscriptionStatus: school.subscriptionStatus,
          trialExpiry: school.trialExpiry,
          planTier: school.planTier,
        };
        // Cache for 5 minutes
        if (redis) {
          try {
            await redis.set(cacheKey, JSON.stringify(schoolData), 'EX', CACHE_TTL.SCHOOL_SUBSCRIPTION);
          } catch {
            // non-fatal — continue without caching
          }
        }
      }
    }

    if (!schoolData || schoolData.isActive === false) {
      return sendForbidden(res, 'School account is inactive. Contact support.');
    }

    const now = new Date();
    const { subscriptionStatus, trialExpiry } = schoolData;

    if (subscriptionStatus === SUBSCRIPTION_STATUSES.SUSPENDED) {
      return sendForbidden(
        res,
        'Your school subscription has been suspended. Please contact support to renew.'
      );
    }

    if (subscriptionStatus === SUBSCRIPTION_STATUSES.EXPIRED) {
      return sendForbidden(
        res,
        'Your school subscription has expired. Please renew to continue.'
      );
    }

    if (subscriptionStatus === SUBSCRIPTION_STATUSES.TRIAL && new Date(trialExpiry) < now) {
      return sendForbidden(
        res,
        'Your free trial has expired. Please subscribe to continue.'
      );
    }
  }

  req.user = user;
  attachAutoAudit(req, res);

  // Per-school rate limiting — only for school-scoped users (not superadmin)
  if (user.schoolId) {
    const limited = await checkSchoolRateLimit(user.schoolId.toString());
    if (limited) {
      return res.status(429).json({
        message: 'Too many requests from your school. Please slow down and try again.',
        retryAfter: 60,
      });
    }
  }

  next();
};

/**
 * blockIfMustChangePassword — must come after protect.
 * Forces the user to change their temporary password before any other action.
 */
export const blockIfMustChangePassword = (req, res, next) => {
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      message: 'You must change your temporary password before continuing.',
      mustChangePassword: true,
    });
  }
  next();
};

/**
 * authorize(...roles) — must come after protect.
 * Checks req.user.role against the allowed roles for this route.
 *
 * Usage: authorize(ROLES.SCHOOL_ADMIN, ROLES.HEADTEACHER)
 */
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return sendForbidden(res, 'You do not have permission to perform this action.');
    }
    next();
  };

/**
 * adminOnly — shorthand for all 4 admin roles.
 */
export const adminOnly = (req, res, next) => {
  const adminRoles = ['school_admin', 'director', 'headteacher', 'deputy_headteacher'];
  if (!adminRoles.includes(req.user?.role)) {
    return sendForbidden(res, 'Admin access required.');
  }
  next();
};

/**
 * superadminOnly — for SaaS-level operations.
 */
export const superadminOnly = (req, res, next) => {
  if (req.user?.role !== 'superadmin') {
    return sendForbidden(res, 'Superadmin access required.');
  }
  next();
};
