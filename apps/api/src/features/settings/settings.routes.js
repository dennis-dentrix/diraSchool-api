import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
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

router.use(protect, blockIfMustChangePassword);

router.get('/',  getSettings);
router.put(
  '/',
  authorize(ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER),
  validateUpdateSettings,
  updateSettings
);

router.post(
  '/holidays',
  authorize(ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER),
  validateAddHoliday,
  addHoliday
);
router.delete(
  '/holidays/:holidayId',
  authorize(ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER),
  deleteHoliday
);

export default router;
