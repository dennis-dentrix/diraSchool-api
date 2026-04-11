import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import { uploadCsv } from '../../middleware/upload.js';
import { PLAN_FEATURES } from '../../constants/index.js';
import {
  validateEnrollStudent,
  validateUpdateStudent,
  validateTransferStudent,
} from './students.validator.js';
import {
  enrollStudent,
  listStudents,
  getStudent,
  updateStudent,
  transferStudent,
  withdrawStudent,
  importStudents,
  getImportStatus,
} from './students.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

router.route('/')
  .get(listStudents)
  .post(validateEnrollStudent, enrollStudent);

// Bulk CSV import — feature-gated + must come before /:id to avoid route collision
// TODO: Assign to correct plan tier in PLAN_FEATURE_MAP once pricing is finalised.
router.post('/import', requireFeature(PLAN_FEATURES.BULK_IMPORT), uploadCsv, importStudents);
router.get('/import/:jobId/status', getImportStatus);

router.route('/:id')
  .get(getStudent)
  .patch(validateUpdateStudent, updateStudent);

router.post('/:id/transfer', validateTransferStudent, transferStudent);
router.post('/:id/withdraw', withdrawStudent);

export default router;
