import mongoose from 'mongoose';
import Class from './Class.model.js';
import Student from '../students/Student.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';
import { getRedis } from '../../config/redis.js';
import { CACHE_TTL, STUDENT_STATUSES } from '../../constants/index.js';

// Invalidate ALL class-list cache entries for a school (on any create/update/delete)
const bustClassCache = async (schoolId) => {
  const redis = getRedis();
  if (!redis) return;
  try {
    const keys = await redis.keys(`school:classes:${schoolId}:*`);
    if (keys.length) await redis.del(...keys);
  } catch { /* non-fatal */ }
};

/**
 * POST /api/v1/classes
 * Creates a new class for the logged-in admin's school.
 */
export const createClass = asyncHandler(async (req, res) => {
  const { name, stream, levelCategory, academicYear, term, classTeacherId } = req.body;

  const cls = await Class.create({
    schoolId: req.user.schoolId,
    name: name.trim(),
    stream: stream?.trim(),
    levelCategory,
    academicYear,
    term,
    classTeacherId: classTeacherId || undefined,
  });

  await bustClassCache(req.user.schoolId);
  return sendSuccess(res, { class: cls }, 201);
});

/**
 * GET /api/v1/classes
 * Lists all classes for the school. Supports ?academicYear=, ?term=, ?levelCategory=, ?isActive=
 * Results are Redis-cached for 10 minutes when no query filters are used.
 */
export const listClasses = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.academicYear) filter.academicYear = req.query.academicYear;
  if (req.query.term) filter.term = req.query.term;
  if (req.query.levelCategory) filter.levelCategory = req.query.levelCategory;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive !== 'false';

  // Cache only unfiltered first-page queries (the most common dashboard call)
  const isSimpleQuery = !req.query.academicYear && !req.query.term &&
    !req.query.levelCategory && req.query.isActive === undefined &&
    (!req.query.page || req.query.page === '1') && !req.query.limit;

  const cacheKey = `school:classes:${req.user.schoolId}:all`;
  const redis = getRedis();

  if (isSimpleQuery && redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return sendSuccess(res, JSON.parse(cached));
      }
    } catch { /* cache miss */ }
  }

  const total = await Class.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const classes = await Class.find(filter)
    .sort({ name: 1, stream: 1 })
    .skip(skip)
    .limit(limit)
    .populate('classTeacherId', 'firstName lastName email');

  const payload = { classes, meta };

  if (isSimpleQuery && redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_TTL.CLASS_LIST);
    } catch { /* non-fatal */ }
  }

  return sendSuccess(res, payload);
});

/**
 * GET /api/v1/classes/:id
 * Returns a single class belonging to the school.
 */
export const getClass = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate('classTeacherId', 'firstName lastName email');

  if (!cls) return sendError(res, 'Class not found.', 404);

  return sendSuccess(res, { class: cls });
});

/**
 * PATCH /api/v1/classes/:id
 * Updates a class. Setting classTeacherId to null unassigns the teacher.
 */
export const updateClass = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!cls) return sendError(res, 'Class not found.', 404);

  const { name, stream, levelCategory, academicYear, term, classTeacherId, isActive } = req.body;

  if (name !== undefined) cls.name = name;
  if (stream !== undefined) cls.stream = stream;
  if (levelCategory !== undefined) cls.levelCategory = levelCategory;
  if (academicYear !== undefined) cls.academicYear = academicYear;
  if (term !== undefined) cls.term = term;
  if (classTeacherId !== undefined) cls.classTeacherId = classTeacherId; // null clears it
  if (isActive !== undefined) cls.isActive = isActive;

  await cls.save();
  await bustClassCache(req.user.schoolId);

  return sendSuccess(res, { class: cls });
});

/**
 * DELETE /api/v1/classes/:id
 * Soft-deletes by setting isActive = false.
 * Hard delete is blocked if the class has students.
 */
export const deleteClass = asyncHandler(async (req, res) => {
  const cls = await Class.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!cls) return sendError(res, 'Class not found.', 404);

  if (cls.studentCount > 0) {
    return sendError(
      res,
      `Cannot delete a class with ${cls.studentCount} enrolled student(s). Transfer or withdraw them first.`,
      409
    );
  }

  await cls.deleteOne();
  await bustClassCache(req.user.schoolId);

  return sendSuccess(res, { message: 'Class deleted.' });
});

/**
 * POST /api/v1/classes/:id/promote
 * Bulk-moves all active students from the source class to the target class.
 * Designed for end-of-year grade promotions (e.g. all Grade 3 → Grade 4).
 *
 * Rules:
 *  - Both classes must belong to the same school.
 *  - Source and target cannot be the same class.
 *  - Only ACTIVE students are moved; withdrawn/transferred/graduated are left.
 *  - studentCount is updated on both classes atomically.
 */
export const promoteClass = asyncHandler(async (req, res) => {
  const { targetClassId } = req.body;
  const sourceClassId = req.params.id;

  if (sourceClassId === targetClassId) {
    return sendError(res, 'Source and target class cannot be the same.', 400);
  }

  const [source, target] = await Promise.all([
    Class.findOne({ _id: sourceClassId, schoolId: req.user.schoolId }),
    Class.findOne({ _id: targetClassId, schoolId: req.user.schoolId }),
  ]);

  if (!source) return sendError(res, 'Source class not found.', 404);
  if (!target) return sendError(res, 'Target class not found.', 404);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Move all active students
    const result = await Student.updateMany(
      { classId: sourceClassId, schoolId: req.user.schoolId, status: STUDENT_STATUSES.ACTIVE },
      { $set: { classId: targetClassId } },
      { session }
    );

    const movedCount = result.modifiedCount;

    // Sync studentCount on both classes
    await Class.updateOne(
      { _id: sourceClassId },
      { $inc: { studentCount: -movedCount } },
      { session }
    );
    await Class.updateOne(
      { _id: targetClassId },
      { $inc: { studentCount: movedCount } },
      { session }
    );

    await session.commitTransaction();
    await bustClassCache(req.user.schoolId);

    return sendSuccess(res, {
      message: `${movedCount} student(s) promoted from ${source.name} to ${target.name}.`,
      movedCount,
      sourceClass: { _id: source._id, name: source.name },
      targetClass: { _id: target._id, name: target.name },
    });
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});
