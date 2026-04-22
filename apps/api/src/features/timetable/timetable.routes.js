import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import {
  createTimetable,
  listTimetables,
  getTimetable,
  updateSlots,
  deleteTimetable,
} from './timetable.controller.js';
import {
  validateCreateTimetable,
  validateListTimetables,
  validateUpdateSlots,
} from './timetable.validator.js';
import { ROLES, PLAN_FEATURES } from '../../constants/index.js';

const router = Router();

// ── Feature gate: timetable module ───────────────────────────────────────────
// Plan-tier feature gate is active via PLAN_FEATURE_MAP.
router.use(protect, blockIfMustChangePassword, requireFeature(PLAN_FEATURES.TIMETABLE));

// Read access: admins + teachers
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.TEACHER, ROLES.DEPARTMENT_HEAD, ROLES.SECRETARY
);

router.get('/',   canRead, validateListTimetables, listTimetables);
router.get('/:id', canRead, getTimetable);

// Write access: school admin, headteacher and deputy headteacher
// (directors are excluded — they approve, not schedule)
const canWrite = authorize(ROLES.SCHOOL_ADMIN, ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER);

router.post('/',            canWrite, validateCreateTimetable, createTimetable);
router.put('/:id/slots',    canWrite, validateUpdateSlots, updateSlots);
router.delete('/:id',       canWrite, deleteTimetable);

export default router;
