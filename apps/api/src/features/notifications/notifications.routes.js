import { Router } from 'express';
import { protect, blockIfMustChangePassword } from '../../middleware/auth.js';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from './notifications.controller.js';

const router = Router();

router.use(protect, blockIfMustChangePassword);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.post('/mark-all-read', markAllNotificationsRead);
router.post('/:id/read', markNotificationRead);

export default router;

