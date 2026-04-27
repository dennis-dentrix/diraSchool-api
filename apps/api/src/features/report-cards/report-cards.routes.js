import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import {
  validateRemarks,
  validateSubjectRemark,
  validateListReportCards,
} from './report-cards.validator.js';
import {
  getAnnualSummary,
  listReportCards,
  getReportCard,
  updateRemarks,
  updateSubjectRemark,
} from './report-cards.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

// ── Read-only access to existing report card data ────────────────────────────
// Generation, publishing, and PDF export have been removed.
// Raw exam results are managed via /api/v1/results.
router.get('/annual-summary', getAnnualSummary);
router.get('/', validateListReportCards, listReportCards);
router.get('/:id', getReportCard);
router.patch('/:id/remarks', validateRemarks, updateRemarks);
router.patch('/:id/subjects/:subjectId/remark', validateSubjectRemark, updateSubjectRemark);

export default router;
