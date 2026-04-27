import express from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { uploadImage } from '../../middleware/upload.js';
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

// image field is optional — teachers may upload text-only plans too
const optionalImage = (req, res, next) => {
  if (!req.is('multipart/form-data')) return next();
  uploadImage('image')(req, res, (err) => {
    // Ignore "no file" error — image upload is optional
    if (err && !err.message?.includes('required')) return res.status(400).json({ error: err.message });
    next();
  });
};

router.route('/')
  .get(academicRoles, listLessonPlans)
  .post(academicRoles, optionalImage, uploadLessonPlan);

router.route('/:id')
  .get(academicRoles, getLessonPlan)
  .delete(academicRoles, deleteLessonPlan);

router.post('/:id/share', academicRoles, shareLessonPlan);
router.delete('/:id/share/:teacherId', academicRoles, unshareLessonPlan);

export default router;
