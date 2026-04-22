import express from 'express';
import { protect, blockIfMustChangePassword, adminOnly, authorize } from '../../middleware/auth.js';
import requireFeature from '../../middleware/requireFeature.js';
import { uploadCsv, uploadImage } from '../../middleware/upload.js';
import { ROLES, PLAN_FEATURES } from '../../constants/index.js';
import {
  validateEnrollStudent,
  validateUpdateStudent,
  validateTransferStudent,
} from './students.validator.js';
import {
  enrollStudent,
  listStudents,
  getStudent,
  updateStudent,
  transferStudent,
  withdrawStudent,
  importStudents,
  getImportStatus,
  uploadStudentPhoto,
} from './students.controller.js';

const router = express.Router();

router.use(protect, blockIfMustChangePassword);

// Read access: all school staff (secretary, accountant, and teachers need to view students)
const canRead = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY, ROLES.ACCOUNTANT, ROLES.TEACHER, ROLES.DEPARTMENT_HEAD
);

router.get('/', canRead, listStudents);
router.get('/import/:jobId/status', canRead, getImportStatus);
router.get('/:id', canRead, getStudent);

// Enroll permissions: admins + secretary + accountant
router.post(
  '/',
  authorize(
    ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
    ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY, ROLES.ACCOUNTANT
  ),
  validateEnrollStudent,
  enrollStudent
);
router.post('/import', adminOnly, requireFeature(PLAN_FEATURES.BULK_IMPORT), uploadCsv, importStudents);
router.patch('/:id', adminOnly, validateUpdateStudent, updateStudent);
router.post('/:id/photo', adminOnly, uploadImage('photo'), uploadStudentPhoto);
router.post('/:id/transfer', adminOnly, validateTransferStudent, transferStudent);
router.post('/:id/withdraw', adminOnly, withdrawStudent);

export default router;
