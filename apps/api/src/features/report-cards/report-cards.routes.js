import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import { PLAN_FEATURES } from '../../constants/index.js';
import {
  validateGenerate,
  validateGenerateClass,
  validateRemarks,
  validateSubjectRemark,
  validateListReportCards,
} from './report-cards.validator.js';
import {
  generateReportCard,
  generateClassReportCards,
  getAnnualSummary,
  listReportCards,
  getReportCard,
  updateRemarks,
  updateSubjectRemark,
  publishReportCard,
  generateReportCardPdf,
} from './report-cards.controller.js';

const router = express.Router();

// ── Feature gate: report cards (plan-tier enforced) ─────────────────────────
router.use(protect, blockIfMustChangePassword, requireFeature(PLAN_FEATURES.REPORT_CARDS), adminOnly);

// ── Generation ────────────────────────────────────────────────────────────────
router.post('/generate', validateGenerate, generateReportCard);
router.post('/generate-class', validateGenerateClass, generateClassReportCards);

// ── CRUD ──────────────────────────────────────────────────────────────────────
// annual-summary MUST be before /:id — otherwise Express matches "annual-summary" as an ObjectId param
router.get('/annual-summary', getAnnualSummary);
router.get('/', validateListReportCards, listReportCards);
router.get('/:id', getReportCard);
router.patch('/:id/remarks', validateRemarks, updateRemarks);
router.patch('/:id/subjects/:subjectId/remark', validateSubjectRemark, updateSubjectRemark);
router.post('/:id/publish', publishReportCard);
router.post('/:id/generate-pdf', generateReportCardPdf);

export default router;
