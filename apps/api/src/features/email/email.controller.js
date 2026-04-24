import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { ROLES } from '../../constants/index.js';
import EmailEvent from './EmailEvent.model.js';

export const listEmailEvents = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role !== ROLES.SUPERADMIN) {
    filter.schoolId = req.user.schoolId;
  } else if (req.query.schoolId) {
    filter.schoolId = req.query.schoolId;
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.provider) filter.provider = req.query.provider;
  if (req.query.template) filter.template = req.query.template;
  if (req.query.to) filter.to = req.query.to.toLowerCase().trim();

  const total = await EmailEvent.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const events = await EmailEvent.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return sendSuccess(res, { events, meta });
});

export const getEmailEvent = asyncHandler(async (req, res) => {
  const event = await EmailEvent.findById(req.params.id).lean();
  if (!event) return sendError(res, 'Email event not found.', 404);

  if (req.user.role !== ROLES.SUPERADMIN) {
    if (!event.schoolId || String(event.schoolId) !== String(req.user.schoolId)) {
      return sendError(res, 'Email event not found.', 404);
    }
  }

  return sendSuccess(res, { event });
});
