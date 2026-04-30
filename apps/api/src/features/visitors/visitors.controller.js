import Visitor from './Visitor.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';

// GET /visitors
export const listVisitors = asyncHandler(async (req, res) => {
  const { from, to, search, limit: limitQ, page: pageQ } = req.query;
  const limit = Math.min(parseInt(limitQ) || 20, 100);
  const page  = Math.max(parseInt(pageQ)  || 1,   1);
  const skip  = (page - 1) * limit;

  const filter = { schoolId: req.user.schoolId };

  if (from || to) {
    filter.visitDate = {};
    if (from) filter.visitDate.$gte = new Date(from);
    if (to)   filter.visitDate.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { reason: { $regex: search, $options: 'i' } },
    ];
  }

  const [visitors, total] = await Promise.all([
    Visitor.find(filter)
      .sort({ visitDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('recordedBy', 'firstName lastName')
      .lean(),
    Visitor.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    visitors,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// POST /visitors
export const createVisitor = asyncHandler(async (req, res) => {
  const { visitDate, name, reason, comment } = req.body;

  if (!visitDate || !name || !reason) {
    return sendError(res, 'visitDate, name, and reason are required.', 400);
  }

  const visitor = await Visitor.create({
    schoolId: req.user.schoolId,
    visitDate: new Date(visitDate),
    name: name.trim(),
    reason: reason.trim(),
    comment: comment?.trim(),
    recordedBy: req.user._id,
  });

  const populated = await visitor.populate('recordedBy', 'firstName lastName');
  return sendSuccess(res, { visitor: populated }, 201);
});

// PATCH /visitors/:id
export const updateVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!visitor) return sendError(res, 'Visitor record not found.', 404);

  const { visitDate, name, reason, comment } = req.body;
  if (visitDate) visitor.visitDate = new Date(visitDate);
  if (name)      visitor.name = name.trim();
  if (reason)    visitor.reason = reason.trim();
  if (typeof comment !== 'undefined') visitor.comment = comment?.trim();

  await visitor.save();
  const populated = await visitor.populate('recordedBy', 'firstName lastName');
  return sendSuccess(res, { visitor: populated });
});

// DELETE /visitors/:id
export const deleteVisitor = asyncHandler(async (req, res) => {
  const visitor = await Visitor.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!visitor) return sendError(res, 'Visitor record not found.', 404);
  await visitor.deleteOne();
  return sendSuccess(res, { message: 'Visitor record deleted.' });
});
