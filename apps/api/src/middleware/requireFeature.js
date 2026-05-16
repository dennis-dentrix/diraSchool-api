import School from '../features/schools/School.model.js';
import { PLAN_FEATURES, TRIAL_FEATURES } from '../constants/index.js';
import { SUBSCRIPTION_STATUSES } from '../constants/index.js';
import { getRedis } from '../config/redis.js';

/**
 * requireFeature(featureKey) — subscription-based feature gate.
 *
 * Two states only:
 *   - active (paid)  → all features available
 *   - trial/expired/suspended → only TRIAL_FEATURES are available
 *
 * Special case: SMS is also unlocked if school.smsSettings.smsEnabled = true
 * (superadmin-controlled addon, independent of subscription status).
 *
 * Place AFTER protect() + blockIfMustChangePassword() in the middleware chain.
 * Superadmin users (no schoolId) always bypass this check.
 *
 * @param {string} feature — one of the PLAN_FEATURES values
 */
const requireFeature = (feature) => async (req, res, next) => {
  if (!req.user?.schoolId) return next();

  const schoolId = req.user.schoolId.toString();
  let subscriptionStatus = null;
  let smsEnabled = false;

  // ── Try the subscription cache first (populated by protect()) ─────────────
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`school:sub:${schoolId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        subscriptionStatus = parsed.subscriptionStatus;
        smsEnabled = parsed.smsEnabled ?? false;
      }
    } catch {
      // cache miss — fall through
    }
  }

  // ── Cold path: read from DB ───────────────────────────────────────────────
  if (!subscriptionStatus) {
    const school = await School.findById(schoolId).select('subscriptionStatus smsSettings.smsEnabled');
    subscriptionStatus = school?.subscriptionStatus ?? SUBSCRIPTION_STATUSES.TRIAL;
    smsEnabled = school?.smsSettings?.smsEnabled ?? false;
  }

  // ── Paid subscription → all features allowed ──────────────────────────────
  if (subscriptionStatus === SUBSCRIPTION_STATUSES.ACTIVE) return next();

  // ── SMS addon override (superadmin-enabled regardless of subscription) ─────
  if (feature === PLAN_FEATURES.SMS && smsEnabled) return next();

  // ── Trial/expired/suspended → only trial features allowed ─────────────────
  if (TRIAL_FEATURES.has(feature)) return next();

  return res.status(403).json({
    message: `The "${feature}" feature requires an active subscription. Please subscribe to access it.`,
    feature,
    subscriptionStatus,
    upgradeRequired: true,
  });
};

export default requireFeature;
