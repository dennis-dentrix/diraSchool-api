import { Router } from 'express';
import {
  protect,
  blockIfMustChangePassword,
  adminOnly,
  superadminOnly,
} from '../../middleware/auth.js';
import {
  validateCreateSchool,
  validateUpdateMySchool,
  validateSuperadminUpdateSchool,
  validateUpdateSubscription,
} from './schools.validator.js';
import {
  getMySchool,
  updateMySchool,
  createSchool,
  listSchools,
  getSchool,
  updateSchool,
  updateSubscription,
} from './schools.controller.js';

const router = Router();

// All routes require a valid session and no pending password change
router.use(protect, blockIfMustChangePassword);

// ── School-admin routes (/api/v1/schools/me) ─────────────────────────────────
// "me" routes must come BEFORE /:id to avoid Express matching "me" as an ObjectId

router
  .route('/me')
  .get(adminOnly, getMySchool)
  .patch(adminOnly, validateUpdateMySchool, updateMySchool);

// ── Superadmin routes (/api/v1/schools) ──────────────────────────────────────

router
  .route('/')
  .get(superadminOnly, listSchools)
  .post(superadminOnly, validateCreateSchool, createSchool);

router
  .route('/:id')
  .get(superadminOnly, getSchool)
  .patch(superadminOnly, validateSuperadminUpdateSchool, updateSchool);

router.patch(
  '/:id/subscription',
  superadminOnly,
  validateUpdateSubscription,
  updateSubscription
);

export default router;
