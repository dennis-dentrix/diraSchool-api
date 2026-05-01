import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import {
  createCheckIn,
  getMyTodayCheckIns,
  getDailyRoster,
  getStaffCheckInHistory,
} from './checkins.controller.js';
import { validateCheckIn } from './checkins.validator.js';

const router = Router();

router.use(protect, blockIfMustChangePassword);

// All school staff can check in
const canCheckIn = authorize(
  ROLES.TEACHER, ROLES.DEPARTMENT_HEAD, ROLES.SECRETARY, ROLES.ACCOUNTANT,
  ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER, ROLES.DIRECTOR,
  ROLES.SCHOOL_ADMIN
);

// Admins and principal see roster
const canViewRoster = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY
);

router.post('/',          canCheckIn,    validateCheckIn, createCheckIn);
router.get('/today',      canCheckIn,    getMyTodayCheckIns);
router.get('/roster',     canViewRoster, getDailyRoster);
router.get('/staff/:staffId', canViewRoster, getStaffCheckInHistory);

export default router;
