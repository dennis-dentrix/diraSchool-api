import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import {
  validateBulkUpsertResults,
  validateUpdateResult,
  validateListResults,
} from './results.validator.js';
import {
  bulkUpsertResults,
  listResults,
  getResult,
  updateResult,
} from './results.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

router.post('/bulk', validateBulkUpsertResults, bulkUpsertResults);

router.route('/')
  .get(validateListResults, listResults);

router.route('/:id')
  .get(getResult)
  .patch(validateUpdateResult, updateResult);

export default router;
