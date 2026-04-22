import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import { uploadImage } from '../../middleware/upload.js';
import {
  getSettings,
  updateSettings,
  addHoliday,
  deleteHoliday,
  uploadSchoolLogo,
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
  '/logo',
  authorize(ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER),
  uploadImage('logo'),
  uploadSchoolLogo
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
