import express from 'express';
import { protect, blockIfMustChangePassword, authorize } from '../../middleware/auth.js';
import { ROLES } from '../../constants/index.js';
import { listEmailEvents, getEmailEvent } from './email.controller.js';

const router = express.Router();

const canReadEmailEvents = authorize(
  ROLES.SUPERADMIN,
  ROLES.SCHOOL_ADMIN,
  ROLES.DIRECTOR,
  ROLES.HEADTEACHER,
  ROLES.DEPUTY_HEADTEACHER
);

router.use(protect, blockIfMustChangePassword, canReadEmailEvents);

router.get('/events', listEmailEvents);
router.get('/events/:id', getEmailEvent);

export default router;
