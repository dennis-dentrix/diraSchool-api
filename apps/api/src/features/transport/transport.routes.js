import { Router } from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import {
  createRoute,
  listRoutes,
  getRoute,
  updateRoute,
  deleteRoute,
  assignStudents,
  unassignStudents,
} from './transport.controller.js';
import {
  validateCreateRoute,
  validateUpdateRoute,
  validateStudentIds,
  validateListRoutes,
} from './transport.validator.js';
import { ROLES, PLAN_FEATURES } from '../../constants/index.js';

const router = Router();

// ── Feature gate: transport module ───────────────────────────────────────────
// TODO: Assign to correct plan tier in PLAN_FEATURE_MAP once pricing is finalised.
router.use(protect, blockIfMustChangePassword, requireFeature(PLAN_FEATURES.TRANSPORT));

// Read access: any school staff
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.TEACHER, ROLES.SECRETARY, ROLES.ACCOUNTANT
);

router.get('/routes',      canRead, validateListRoutes, listRoutes);
router.get('/routes/:id',  canRead, getRoute);

// Write access: admins only
router.post('/routes',                   adminOnly, validateCreateRoute, createRoute);
router.patch('/routes/:id',              adminOnly, validateUpdateRoute, updateRoute);
router.delete('/routes/:id',             adminOnly, deleteRoute);
router.post('/routes/:id/assign',        adminOnly, validateStudentIds, assignStudents);
router.post('/routes/:id/unassign',      adminOnly, validateStudentIds, unassignStudents);

export default router;
