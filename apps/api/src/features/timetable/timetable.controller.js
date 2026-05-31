import Timetable from './Timetable.model.js';
import Class from '../classes/Class.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';

const POPULATE = [
  { path: 'classId', select: 'name stream levelCategory' },
  { path: 'slots.subjectId', select: 'name code' },
  { path: 'slots.teacherId', select: 'firstName lastName' },
];

/**
 * POST /api/v1/timetables
 */
export const createTimetable = asyncHandler(async (req, res) => {
  const { classId, academicYear, term, slots = [] } = req.body;
  const schoolId = req.user.schoolId;

  const cls = await Class.findOne({ _id: classId, schoolId }).lean();
  if (!cls) return sendError(res, 'Class not found.', 404);

  try {
    const timetable = await Timetable.create({ schoolId, classId, academicYear, term, slots });
    const populated = await Timetable.findById(timetable._id).populate(POPULATE).lean();
    return sendSuccess(res, { timetable: populated }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 'A timetable for this class, term and academic year already exists.', 409);
    }
    throw err;
  }
});

/**
 * GET /api/v1/timetables
 */
export const listTimetables = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.classId)      filter.classId           = req.query.classId;
  if (req.query.academicYear) filter.academicYear       = req.query.academicYear;
  if (req.query.term)         filter.term               = req.query.term;
  if (req.query.teacherId)    filter['slots.teacherId'] = req.query.teacherId;

  const total = await Timetable.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const timetables = await Timetable.find(filter)
    .sort({ academicYear: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate(POPULATE)
    .lean();

  return sendSuccess(res, { timetables, meta });
});

/**
 * GET /api/v1/timetables/:id
 */
export const getTimetable = asyncHandler(async (req, res) => {
  const timetable = await Timetable.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate(POPULATE)
    .lean();

  if (!timetable) return sendError(res, 'Timetable not found.', 404);
  return sendSuccess(res, { timetable });
});

/**
 * PUT /api/v1/timetables/:id/slots
 * Replaces all slots in the timetable.
 */
export const updateSlots = asyncHandler(async (req, res) => {
  // Need full hydration here so we can call .save()
  const timetable = await Timetable.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!timetable) return sendError(res, 'Timetable not found.', 404);

  timetable.slots = req.body.slots;
  await timetable.save();

  const populated = await Timetable.findById(timetable._id).populate(POPULATE).lean();
  return sendSuccess(res, { timetable: populated });
});

/**
 * DELETE /api/v1/timetables/:id
 */
export const deleteTimetable = asyncHandler(async (req, res) => {
  const timetable = await Timetable.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!timetable) return sendError(res, 'Timetable not found.', 404);

  await timetable.deleteOne();
  return sendSuccess(res, { message: 'Timetable deleted.' });
});
