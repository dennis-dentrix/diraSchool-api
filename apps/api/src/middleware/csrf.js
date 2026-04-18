import { env } from '../config/env.js';

// Must stay in sync with config/cors.js
const ALLOWED_ORIGINS = [
  env.CLIENT_URL,
  env.CLIENT_URL_STAGING,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'https://diraschool.com',
  'https://www.diraschool.com',
  'diraschool.com',
].filter(Boolean);

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * csrf — programmatic Origin/Referer guard for state-changing requests.
 *
 * This is a belt-and-suspenders layer that sits AFTER the browser-level
 * SameSite cookie and CORS protections.  It ensures that even if CORS is
 * accidentally misconfigured in the future, forged cross-site requests are
 * rejected at the application level.
 *
 * Decision tree:
 *  1. Non-state-changing method (GET, HEAD, OPTIONS) → pass through.
 *  2. No Origin AND no Referer → non-browser client (curl / mobile SDK /
 *     server-to-server) → allow. These cannot initiate CSRF attacks.
 *  3. Origin header present → validate against allow-list.
 *  4. No Origin but Referer present (some older browsers / redirects) →
 *     extract origin from Referer and validate.
 *  5. Neither header present (already handled by step 2).
 *
 * Why not a CSRF token?
 *  - `SameSite=Strict` on the cookie (production) already provides full
 *    protection — the browser will not send the cookie for any cross-site
 *    request, making token-based CSRF schemes redundant.
 *  - `SameSite=Lax` (development) blocks all non-GET cross-site requests.
 *  - `Content-Type: application/json` on every JSON endpoint cannot be set
 *    by a cross-site HTML form without triggering a CORS preflight, which
 *    the CORS middleware will reject.
 *  - This Origin check is the final programmatic backstop.
 */
export const csrf = (req, res, next) => {
  // ── 1. Only guard state-changing methods ──────────────────────────────────
  if (!STATE_CHANGING.has(req.method)) return next();

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  // ── 2. No browser headers → non-browser client → allow ───────────────────
  if (!origin && !referer) return next();

  // ── 3. Validate Origin header (sent by all modern browsers on cross-origin) ─
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) return next();
    return res.status(403).json({
      success: false,
      message: 'CSRF check failed: request origin is not allowed.',
    });
  }

  // ── 4. Fallback: validate Referer if Origin is absent ─────────────────────
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) return next();
    } catch {
      // Malformed Referer — reject
    }
    return res.status(403).json({
      success: false,
      message: 'CSRF check failed: request referer is not allowed.',
    });
  }

  next();
};
