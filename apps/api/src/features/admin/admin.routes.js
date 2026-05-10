import express from 'express';
import { protect, superadminOnly } from '../../middleware/auth.js';
import {
  getStats,
  listSchools,
  getSchool,
  updateSchoolStatus,
  reviewSchoolDeactivationRequest,
  listSystemAuditLogs,
  listAdminUsers,
  toggleAdminUser,
  triggerMonitoringTest,
  approveSmsenderId,
  getSmsAnalytics,
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addSchoolToGroup,
  removeSchoolFromGroup,
} from './admin.controller.js';

const router = express.Router();

// All admin routes require a valid session AND superadmin role
router.use(protect, superadminOnly);

router.get('/stats',                        getStats);
router.get('/schools',                      listSchools);
router.get('/schools/:id',                  getSchool);
router.patch('/schools/:id/status',         updateSchoolStatus);
router.patch('/schools/:id/deactivation-request', reviewSchoolDeactivationRequest);
router.patch('/schools/:id/sms-sender-id',  approveSmsenderId);
router.get('/audit-logs',                   listSystemAuditLogs);
router.get('/users',                        listAdminUsers);
router.patch('/users/:id/toggle',           toggleAdminUser);
router.post('/monitoring-test',             triggerMonitoringTest);
router.get('/sms-analytics',               getSmsAnalytics);

// School billing groups
router.post('/groups',                           createGroup);
router.get('/groups',                            listGroups);
router.get('/groups/:id',                        getGroup);
router.patch('/groups/:id',                      updateGroup);
router.delete('/groups/:id',                     deleteGroup);
router.post('/groups/:id/schools',               addSchoolToGroup);
router.delete('/groups/:id/schools/:schoolId',   removeSchoolFromGroup);

export default router;
