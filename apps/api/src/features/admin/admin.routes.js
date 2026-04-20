import express from 'express';
import { protect, superadminOnly } from '../../middleware/auth.js';
import {
  getStats,
  listSchools,
  getSchool,
  updateSchoolStatus,
  listSystemAuditLogs,
  listAdminUsers,
  toggleAdminUser,
  triggerMonitoringTest,
} from './admin.controller.js';

const router = express.Router();

// All admin routes require a valid session AND superadmin role
router.use(protect, superadminOnly);

router.get('/stats',                  getStats);
router.get('/schools',                listSchools);
router.get('/schools/:id',            getSchool);
router.patch('/schools/:id/status',   updateSchoolStatus);
router.get('/audit-logs',             listSystemAuditLogs);
router.get('/users',                  listAdminUsers);
router.patch('/users/:id/toggle',     toggleAdminUser);
router.post('/monitoring-test',       triggerMonitoringTest);

export default router;
