import { Router } from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import { listVisitors, createVisitor, updateVisitor, deleteVisitor } from './visitors.controller.js';

const router = Router();

router.use(protect, blockIfMustChangePassword);

const canAccess = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY
);

const canWrite = authorize(
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER, ROLES.SECRETARY
);

router.get('/', canAccess, listVisitors);
router.post('/', canWrite, createVisitor);
router.patch('/:id', canWrite, updateVisitor);
router.delete('/:id', canWrite, deleteVisitor);

export default router;
