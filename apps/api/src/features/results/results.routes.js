import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import {
  validateBulkUpsertResults,
  validateUpdateResult,
  validateListResults,
  validateSessionSave,
  validateSessionGet,
} from './results.validator.js';
import {
  bulkUpsertResults,
  listResults,
  getResult,
  updateResult,
  getSessionResults,
  sessionSaveResults,
} from './results.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

// Session routes must be before /:id to avoid param conflicts
router.route('/session')
  .get(validateSessionGet, getSessionResults)
  .post(validateSessionSave, sessionSaveResults);

router.post('/bulk', validateBulkUpsertResults, bulkUpsertResults);

router.route('/')
  .get(validateListResults, listResults);

router.route('/:id')
  .get(getResult)
  .patch(validateUpdateResult, updateResult);

export default router;
