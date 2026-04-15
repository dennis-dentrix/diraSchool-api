import express from 'express';
import { protect, superadminOnly } from '../../middleware/auth.js';
import {
  getStats,
  listSchools,
  getSchool,
  updateSchoolStatus,
} from './admin.controller.js';

const router = express.Router();

// All admin routes require a valid session AND superadmin role
router.use(protect, superadminOnly);

router.get('/stats',               getStats);
router.get('/schools',             listSchools);
router.get('/schools/:id',         getSchool);
router.patch('/schools/:id/status', updateSchoolStatus);

export default router;
