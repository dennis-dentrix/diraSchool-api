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
  updateSchoolPricingAgreement,
  updateGroupPricingAgreement,
  getFinanceSummary,
  listFinancePayments,
  listPlatformExpenses,
  createPlatformExpense,
  updatePlatformExpense,
  deletePlatformExpense,
  listPlatformTaxRecords,
  createPlatformTaxRecord,
  updatePlatformTaxRecord,
  deletePlatformTaxRecord,
  createGroup,
  listGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addSchoolToGroup,
  removeSchoolFromGroup,
  purgeSchool,
  previewOrphans,
  purgeOrphans,
  listSystemEvents,
  createSystemEvent,
  updateSystemEvent,
  deleteSystemEvent,
  broadcastSystemEvent,
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
router.patch('/schools/:id/pricing-agreement', updateSchoolPricingAgreement);
router.get('/audit-logs',                   listSystemAuditLogs);
router.get('/users',                        listAdminUsers);
router.patch('/users/:id/toggle',           toggleAdminUser);
router.post('/monitoring-test',             triggerMonitoringTest);
router.get('/sms-analytics',               getSmsAnalytics);

// Platform finance
router.get('/finance/summary',              getFinanceSummary);
router.get('/finance/payments',             listFinancePayments);
router.get('/finance/expenses',             listPlatformExpenses);
router.post('/finance/expenses',            createPlatformExpense);
router.patch('/finance/expenses/:id',       updatePlatformExpense);
router.delete('/finance/expenses/:id',      deletePlatformExpense);
router.get('/finance/taxes',                listPlatformTaxRecords);
router.post('/finance/taxes',               createPlatformTaxRecord);
router.patch('/finance/taxes/:id',          updatePlatformTaxRecord);
router.delete('/finance/taxes/:id',         deletePlatformTaxRecord);

// School billing groups
router.post('/groups',                           createGroup);
router.get('/groups',                            listGroups);
router.get('/groups/:id',                        getGroup);
router.patch('/groups/:id',                      updateGroup);
router.delete('/groups/:id',                     deleteGroup);
router.patch('/groups/:id/pricing-agreement',    updateGroupPricingAgreement);
router.post('/groups/:id/schools',               addSchoolToGroup);
router.delete('/groups/:id/schools/:schoolId',   removeSchoolFromGroup);

// Test-data purge (danger zone)
router.delete('/purge/school/:id',              purgeSchool);
router.get('/purge/orphans/preview',            previewOrphans);
router.delete('/purge/orphans',                 purgeOrphans);

// System events
router.get('/system-events',                    listSystemEvents);
router.post('/system-events',                   createSystemEvent);
router.patch('/system-events/:id',              updateSystemEvent);
router.delete('/system-events/:id',             deleteSystemEvent);
router.post('/system-events/:id/broadcast',     broadcastSystemEvent);

export default router;
