import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
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

// Transport is managed by deputy headteacher, secretary, and accountant.
// School admin and headteacher retain full access.
const canAccess = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY, ROLES.ACCOUNTANT
);

router.get('/routes',      canAccess, validateListRoutes, listRoutes);
router.get('/routes/:id',  canAccess, getRoute);

// Write access: same roles — transport is operational, not teacher-facing
router.post('/routes',                   canAccess, validateCreateRoute, createRoute);
router.patch('/routes/:id',              canAccess, validateUpdateRoute, updateRoute);
router.delete('/routes/:id',             canAccess, deleteRoute);
router.post('/routes/:id/assign',        canAccess, validateStudentIds, assignStudents);
router.post('/routes/:id/unassign',      canAccess, validateStudentIds, unassignStudents);

export default router;
