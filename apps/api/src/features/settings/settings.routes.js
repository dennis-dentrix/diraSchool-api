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
import { updateGeofence, updateCheckInTimes } from '../checkins/checkins.controller.js';
import { validateGeofence, validateCheckInTimes } from '../checkins/checkins.validator.js';

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

// Geofence configuration — school admin only
router.put(
  '/geofence',
  authorize(ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER),
  validateGeofence,
  updateGeofence
);

// Check-in / check-out deadline times
router.put(
  '/checkin-times',
  authorize(ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER),
  validateCheckInTimes,
  updateCheckInTimes
);

export default router;
