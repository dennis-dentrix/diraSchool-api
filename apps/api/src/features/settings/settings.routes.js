import { Router } from 'express';
import { protect, blockIfMustChangePassword, adminOnly } from '../../middleware/auth.js';
import {
  getSettings,
  updateSettings,
  addHoliday,
  deleteHoliday,
} from './settings.controller.js';
import {
  validateUpdateSettings,
  validateAddHoliday,
} from './settings.validator.js';

const router = Router();

router.use(protect, blockIfMustChangePassword, adminOnly);

router.get('/',  getSettings);
router.put('/',  validateUpdateSettings, updateSettings);

router.post('/holidays',              validateAddHoliday, addHoliday);
router.delete('/holidays/:holidayId', deleteHoliday);

export default router;
