import express from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { uploadImages } from '../../middleware/upload.js';
import { ROLES } from '../../constants/index.js';
import {
  uploadLessonPlan,
  listLessonPlans,
  getLessonPlan,
  deleteLessonPlan,
  shareLessonPlan,
  unshareLessonPlan,
} from './lesson-plans.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

const academicRoles = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER,
  ROLES.TEACHER, ROLES.DEPARTMENT_HEAD
);

// images field is optional — up to 20 images, 10 MB each
const optionalImages = (req, res, next) => {
  uploadImages('images', 20)(req, res, next);
};

router.route('/')
  .get(academicRoles, listLessonPlans)
  .post(academicRoles, optionalImages, uploadLessonPlan);

router.route('/:id')
  .get(academicRoles, getLessonPlan)
  .delete(academicRoles, deleteLessonPlan);

router.post('/:id/share', academicRoles, shareLessonPlan);
router.delete('/:id/share/:teacherId', academicRoles, unshareLessonPlan);

export default router;
