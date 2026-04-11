import TransportRoute from './TransportRoute.model.js';
import Student from '../students/Student.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { paginate } from '../../utils/pagination.js';

/**
 * POST /api/v1/transport/routes
 */
export const createRoute = asyncHandler(async (req, res) => {
  const schoolId = req.user.schoolId;

  try {
    const route = await TransportRoute.create({ schoolId, ...req.body });
    return sendSuccess(res, { route }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 'A route with this name already exists.', 409);
    }
    throw err;
  }
});

/**
 * GET /api/v1/transport/routes
 */
export const listRoutes = asyncHandler(async (req, res) => {
  const filter = { schoolId: req.user.schoolId };
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const total = await TransportRoute.countDocuments(filter);
  const { skip, limit, meta } = paginate(req.query, total);

  const routes = await TransportRoute.find(filter)
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, { routes, meta });
});

/**
 * GET /api/v1/transport/routes/:id
 * Returns the route + a list of students currently assigned to it.
 */
export const getRoute = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!route) return sendError(res, 'Transport route not found.', 404);

  // Fetch students whose routeId points to this route
  const students = await Student.find({
    routeId: route._id,
    schoolId: req.user.schoolId,
  })
    .select('firstName lastName admissionNumber classId status')
    .populate('classId', 'name stream');

  return sendSuccess(res, { route, students });
});

/**
 * PATCH /api/v1/transport/routes/:id
 */
export const updateRoute = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!route) return sendError(res, 'Transport route not found.', 404);

  try {
    Object.assign(route, req.body);
    await route.save();
    return sendSuccess(res, { route });
  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, 'A route with this name already exists.', 409);
    }
    throw err;
  }
});

/**
 * DELETE /api/v1/transport/routes/:id
 * Blocked if any students are currently on this route.
 */
export const deleteRoute = asyncHandler(async (req, res) => {
  const route = await TransportRoute.findOne({
    _id: req.params.id,
    schoolId: req.user.schoolId,
  });

  if (!route) return sendError(res, 'Transport route not found.', 404);

  const assignedCount = await Student.countDocuments({
    routeId: route._id,
    schoolId: req.user.schoolId,
  });

  if (assignedCount > 0) {
    return sendError(
      res,
      `Cannot delete route — ${assignedCount} student(s) are still assigned to it. Unassign them first.`,
      409
    );
  }

  await route.deleteOne();
  return sendSuccess(res, { message: 'Transport route deleted.' });
});

/**
 * POST /api/v1/transport/routes/:id/assign
 * Bulk-assigns students to this route (sets Student.routeId).
 */
export const assignStudents = asyncHandler(async (req, res) => {
  const { studentIds } = req.body;
  const schoolId = req.user.schoolId;

  const route = await TransportRoute.findOne({ _id: req.params.id, schoolId });
  if (!route) return sendError(res, 'Transport route not found.', 404);

  // Only update students that belong to this school (safety guard)
  const result = await Student.updateMany(
    { _id: { $in: studentIds }, schoolId },
    { $set: { routeId: route._id } }
  );

  return sendSuccess(res, {
    message: `${result.modifiedCount} student(s) assigned to route "${route.name}".`,
    modifiedCount: result.modifiedCount,
  });
});

/**
 * POST /api/v1/transport/routes/:id/unassign
 * Removes this route from the specified students.
 */
export const unassignStudents = asyncHandler(async (req, res) => {
  const { studentIds } = req.body;
  const schoolId = req.user.schoolId;

  const route = await TransportRoute.findOne({ _id: req.params.id, schoolId });
  if (!route) return sendError(res, 'Transport route not found.', 404);

  const result = await Student.updateMany(
    { _id: { $in: studentIds }, schoolId, routeId: route._id },
    { $unset: { routeId: '' } }
  );

  return sendSuccess(res, {
    message: `${result.modifiedCount} student(s) unassigned from route "${route.name}".`,
    modifiedCount: result.modifiedCount,
  });
});
