import { Router } from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import { listAuditLogs } from './audit.controller.js';
import { PLAN_FEATURES } from '../../constants/index.js';

const router = Router();

// ── Feature gate: audit log ───────────────────────────────────────────────────
// TODO: Assign to correct plan tier in PLAN_FEATURE_MAP once pricing is finalised.
router.use(protect, blockIfMustChangePassword, requireFeature(PLAN_FEATURES.AUDIT_LOG), adminOnly);

router.get('/', listAuditLogs);

export default router;
