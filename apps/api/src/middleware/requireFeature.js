import School from '../features/schools/School.model.js';
import { PLAN_FEATURE_MAP, PLAN_TIERS } from '../constants/index.js';
import { getRedis } from '../config/redis.js';

/**
 * requireFeature(featureKey) — plan-based feature gate.
 *
 * Place AFTER protect() + blockIfMustChangePassword() in the middleware chain.
 * Superadmin users (no schoolId) always bypass this check.
 *
 * How it works:
 *  1. Reads planTier from the existing school subscription Redis cache
 *     (populated by protect() — zero extra DB round-trips in the common case).
 *  2. Falls back to a direct DB read if the cache key is cold.
 *  3. Checks PLAN_FEATURE_MAP[planTier] for the requested feature key.
 *  4. Returns 403 with an upgrade message if the feature is not in the plan.
 *
 * To activate feature gating once pricing is decided:
 *   1. Edit PLAN_FEATURE_MAP in constants/index.js — remove the feature from
 *      lower tiers.  No other code needs to change.
 *
 * @param {string} feature — one of the PLAN_FEATURES values
 */
const requireFeature = (feature) => async (req, res, next) => {
  // Superadmin has no schoolId — always allowed through
  if (!req.user?.schoolId) return next();

  const schoolId = req.user.schoolId.toString();
  let planTier = null;

  // ── Try the subscription cache first ──────────────────────────────────────
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(`school:sub:${schoolId}`);
      if (cached) planTier = JSON.parse(cached).planTier;
    } catch {
      // cache miss — fall through
    }
  }

  // ── Cold path: read from DB ────────────────────────────────────────────────
  if (!planTier) {
    const school = await School.findById(schoolId).select('planTier');
    planTier = school?.planTier ?? PLAN_TIERS.TRIAL;
  }

  // ── Check feature against plan map ────────────────────────────────────────
  const allowedFeatures = PLAN_FEATURE_MAP[planTier] ?? [];

  if (!allowedFeatures.includes(feature)) {
    return res.status(403).json({
      message: `The "${feature}" feature is not available on your current plan (${planTier}). Please upgrade to access it.`,
      feature,
      currentPlan: planTier,
      upgradeRequired: true,
    });
  }

  next();
};

export default requireFeature;
