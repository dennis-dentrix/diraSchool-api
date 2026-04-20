import Notification from './Notification.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId, userId: req.user._id };
  const total = await Notification.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, { notifications, meta });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    schoolId: req.user.schoolId,
    userId: req.user._id,
    readAt: null,
  });

  return sendSuccess(res, { count });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, schoolId: req.user.schoolId, userId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true }
  );

  return sendSuccess(res, { notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { schoolId: req.user.schoolId, userId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  return sendSuccess(res, { message: 'All notifications marked as read.' });
});

