import Department from './Department.model.js';
import Subject from './Subject.model.js';
import User from '../users/User.model.js';
import School from '../schools/School.model.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { ROLES } from '../../constants/index.js';
import { createNotification } from '../../services/notification.service.js';
import { sendDepartmentMemberEmail } from '../../services/email.service.js';
import logger from '../../config/logger.js';

const MEMBER_ROLES = [ROLES.TEACHER, ROLES.DEPARTMENT_HEAD];

const populateDept = (query) =>
  query
    .populate('hodId', 'firstName lastName email')
    .populate('memberIds', 'firstName lastName email role');

const withSubjectCount = async (schoolId, dept) => {
  const subjectCount = await Subject.countDocuments({ schoolId, department: dept.name });
  return { ...dept.toObject(), subjectCount };
};

const resolveTeacher = async (schoolId, userId, label = 'User') => {
  const user = await User.findOne({ _id: userId, schoolId, role: { $in: MEMBER_ROLES }, isActive: true });
  if (!user) return { error: `${label} not found or is not an active teacher in this school.` };
  return { user };
};

/**
 * GET /api/v1/subjects/departments
 */
export const listDepartments = asyncHandler(async (req, res) => {
  const departments = await populateDept(
    Department.find({ schoolId: req.user.schoolId }).sort({ name: 1 })
  );

  const names = departments.map((d) => d.name);
  const counts = await Subject.aggregate([
    { $match: { schoolId: req.user.schoolId, department: { $in: names } } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  const result = departments.map((d) => ({
    ...d.toObject(),
    subjectCount: countMap[d.name] ?? 0,
  }));

  return sendSuccess(res, { departments: result });
});

/**
 * POST /api/v1/subjects/departments
 */
export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description, hodId, memberIds = [] } = req.body;

  if (!name?.trim()) return sendError(res, 'Department name is required.', 400);

  const exists = await Department.findOne({ schoolId: req.user.schoolId, name: name.trim() });
  if (exists) return sendError(res, 'A department with that name already exists.', 409);

  if (hodId) {
    const { error } = await resolveTeacher(req.user.schoolId, hodId, 'Head of Department');
    if (error) return sendError(res, error, 404);
  }

  // Validate member IDs
  if (memberIds.length) {
    const found = await User.find({ _id: { $in: memberIds }, schoolId: req.user.schoolId, role: { $in: MEMBER_ROLES }, isActive: true }).select('_id');
    if (found.length !== memberIds.length) return sendError(res, 'One or more member IDs are invalid.', 400);
  }

  const dept = await Department.create({
    schoolId: req.user.schoolId,
    name: name.trim(),
    description: description?.trim(),
    hodId: hodId || null,
    memberIds,
  });

  const populated = await populateDept(Department.findById(dept._id));
  return sendSuccess(res, { department: { ...populated.toObject(), subjectCount: 0 } }, 201);
});

/**
 * PATCH /api/v1/subjects/departments/:id
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!dept) return sendError(res, 'Department not found.', 404);

  const { name, description, hodId } = req.body;
  const oldName = dept.name;

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) return sendError(res, 'Department name cannot be empty.', 400);
    const conflict = await Department.findOne({ schoolId: req.user.schoolId, name: trimmed, _id: { $ne: dept._id } });
    if (conflict) return sendError(res, 'A department with that name already exists.', 409);
    dept.name = trimmed;
  }

  if (description !== undefined) dept.description = description?.trim() || undefined;

  if (hodId !== undefined) {
    if (hodId === null) {
      dept.hodId = null;
    } else {
      const { user, error } = await resolveTeacher(req.user.schoolId, hodId, 'Head of Department');
      if (error) return sendError(res, error, 404);
      dept.hodId = user._id;
    }
  }

  await dept.save();

  if (name !== undefined && dept.name !== oldName) {
    await Subject.updateMany({ schoolId: req.user.schoolId, department: oldName }, { department: dept.name });
  }

  const populated = await populateDept(Department.findById(dept._id));
  return sendSuccess(res, { department: await withSubjectCount(req.user.schoolId, populated) });
});

/**
 * DELETE /api/v1/subjects/departments/:id
 */
export const deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!dept) return sendError(res, 'Department not found.', 404);

  const subjectCount = await Subject.countDocuments({ schoolId: req.user.schoolId, department: dept.name });
  if (subjectCount > 0) {
    return sendError(res, `Cannot delete: ${subjectCount} subject${subjectCount !== 1 ? 's' : ''} are assigned to this department. Reassign them first.`, 409);
  }

  await dept.deleteOne();
  return sendSuccess(res, { message: 'Department deleted.' });
});

/**
 * POST /api/v1/subjects/departments/:id/members
 * Body: { userId }
 */
export const addMember = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!dept) return sendError(res, 'Department not found.', 404);

  const { userId } = req.body;
  if (!userId) return sendError(res, 'userId is required.', 400);

  const { user, error } = await resolveTeacher(req.user.schoolId, userId);
  if (error) return sendError(res, error, 404);

  const alreadyMember = dept.memberIds.some((id) => id.equals(user._id));
  if (!alreadyMember) {
    dept.memberIds.push(user._id);
    await dept.save();

    // Notify and email the added teacher (fire-and-forget)
    try {
      const school = await School.findById(req.user.schoolId).select('name').lean();
      const schoolName = school?.name ?? 'your school';
      await Promise.all([
        createNotification({
          schoolId: req.user.schoolId,
          userId: user._id,
          title: `Added to ${dept.name} department`,
          message: `You have been added to the ${dept.name} department at ${schoolName}.`,
          type: 'info',
          link: '/subjects',
        }),
        sendDepartmentMemberEmail({
          to: user.email,
          firstName: user.firstName,
          schoolName,
          departmentName: dept.name,
          action: 'added',
          meta: { schoolId: req.user.schoolId, userId: String(user._id) },
        }).catch((err) => logger.warn('[Dept] member-added email failed', { err: err.message })),
      ]);
    } catch (err) {
      logger.warn('[Dept] Failed to notify added member', { err: err.message });
    }
  }

  const populated = await populateDept(Department.findById(dept._id));
  return sendSuccess(res, { department: await withSubjectCount(req.user.schoolId, populated) });
});

/**
 * DELETE /api/v1/subjects/departments/:id/members/:userId
 */
export const removeMember = asyncHandler(async (req, res) => {
  const dept = await Department.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!dept) return sendError(res, 'Department not found.', 404);

  const wasMember = dept.memberIds.some((id) => id.equals(req.params.userId));
  dept.memberIds = dept.memberIds.filter((id) => !id.equals(req.params.userId));
  await dept.save();

  // Notify and email the removed teacher (fire-and-forget)
  if (wasMember) {
    try {
      const [removedUser, school] = await Promise.all([
        User.findById(req.params.userId).select('firstName lastName email').lean(),
        School.findById(req.user.schoolId).select('name').lean(),
      ]);
      if (removedUser) {
        const schoolName = school?.name ?? 'your school';
        await Promise.all([
          createNotification({
            schoolId: req.user.schoolId,
            userId: removedUser._id,
            title: `Removed from ${dept.name} department`,
            message: `You have been removed from the ${dept.name} department at ${schoolName}.`,
            type: 'info',
            link: '/subjects',
          }),
          sendDepartmentMemberEmail({
            to: removedUser.email,
            firstName: removedUser.firstName,
            schoolName,
            departmentName: dept.name,
            action: 'removed',
            meta: { schoolId: req.user.schoolId, userId: String(removedUser._id) },
          }).catch((err) => logger.warn('[Dept] member-removed email failed', { err: err.message })),
        ]);
      }
    } catch (err) {
      logger.warn('[Dept] Failed to notify removed member', { err: err.message });
    }
  }

  const populated = await populateDept(Department.findById(dept._id));
  return sendSuccess(res, { department: await withSubjectCount(req.user.schoolId, populated) });
});
