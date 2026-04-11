import AuditLog from './AuditLog.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';

/**
 * GET /api/v1/audit-logs
 * Lists audit log entries for the school, newest first.
 * Supports optional filters: resource, action, userId, from, to.
 */
export const listAuditLogs = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };

  if (req.query.resource)  filter.resource = req.query.resource;
  if (req.query.action)    filter.action   = req.query.action;
  if (req.query.userId)    filter.userId   = req.query.userId;
  if (req.query.resourceId) filter.resourceId = req.query.resourceId;

  // Date range filter on createdAt
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
  }

  const total = await AuditLog.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const logs = await AuditLog.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'firstName lastName role');

  return sendSuccess(res, { logs, meta });
});
