import Notification from '../features/notifications/Notification.model.js';
import logger from '../config/logger.js';

/**
 * Best-effort in-app notification helper.
 * Never throws, so business workflows do not fail due to notification errors.
 */
export const notifyUser = async ({
  schoolId,
  userId,
  title,
  message,
  type = 'info',
  link,
  meta,
}) => {
  try {
    if (!schoolId || !userId || !title) return null;
    return await Notification.create({ schoolId, userId, title, message, type, link, meta });
  } catch (err) {
    logger.warn('[Notify] Failed to create in-app notification', { err: err.message, userId, schoolId });
    return null;
  }
};

