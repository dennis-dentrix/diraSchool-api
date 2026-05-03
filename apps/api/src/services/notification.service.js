import Notification from '../features/notifications/Notification.model.js';
import { emitToUser } from '../config/socket.js';
import logger from '../config/logger.js';

/**
 * Create a notification in the database and push it to the user's active
 * socket connection in real time.
 *
 * Use this everywhere you previously would have called Notification.create()
 * directly so the socket emit is never forgotten.
 */
export const createNotification = async ({
  schoolId,
  userId,
  title,
  message,
  type = 'info',
  link,
  meta = {},
}) => {
  try {
    const notification = await Notification.create({
      schoolId,
      userId,
      title,
      message,
      type,
      link,
      meta,
    });

    // Count updated unread total so the client badge stays accurate
    const unreadCount = await Notification.countDocuments({
      schoolId,
      userId,
      readAt: null,
    });

    emitToUser(String(userId), 'notification:new', {
      notification: notification.toObject(),
      unreadCount,
    });

    return notification;
  } catch (err) {
    // Never crash a business operation because a notification failed
    logger.error('[Notification] Failed to create notification', {
      userId: String(userId),
      title,
      err: err.message,
    });
    return null;
  }
};
