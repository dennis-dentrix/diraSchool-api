import LessonPlan           from './LessonPlan.model.js';
import User                  from '../users/User.model.js';
import asyncHandler          from '../../utils/asyncHandler.js';
import { sendSuccess, sendError, sendForbidden } from '../../utils/response.js';
import { uploadBuffer, deleteFile } from '../../jobs/helpers/cloudinaryUpload.js';
import { ROLES }             from '../../constants/index.js';

const VIEWER_ROLES = [
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER,
];
const SHARER_ROLES = [
  ROLES.SCHOOL_ADMIN, ROLES.DIRECTOR, ROLES.HEADTEACHER, ROLES.DEPUTY_HEADTEACHER,
];

function canView(user, plan) {
  if (VIEWER_ROLES.includes(user.role)) return true;
  const uid = String(user._id);
  if (String(plan.teacherId?._id ?? plan.teacherId) === uid) return true;
  return plan.sharedWith?.some((id) => String(id) === uid);
}

// POST /lesson-plans  (multipart/form-data with field "image")
export const uploadLessonPlan = asyncHandler(async (req, res) => {
  const { title, description, type, academicYear, term, weekNumber, classId, subjectId } = req.body;

  if (!title || !academicYear || !term) {
    return sendError(res, 'title, academicYear, and term are required.', 400);
  }

  let imageUrl, imagePublicId;

  if (req.file) {
    const upload = await uploadBuffer(req.file.buffer, {
      folder:        `lesson-plans/${req.user.schoolId}`,
      public_id:     `${req.user._id}_${Date.now()}`,
      resource_type: 'image',
    });
    if (!upload?.url) {
      return sendError(res, 'Image upload failed. Check Cloudinary configuration.', 503);
    }
    imageUrl      = upload.url;
    imagePublicId = upload.publicId;
  }

  const plan = await LessonPlan.create({
    schoolId:    req.user.schoolId,
    teacherId:   req.user._id,
    classId:     classId || undefined,
    subjectId:   subjectId || undefined,
    title:       title.trim(),
    description: description?.trim(),
    type:        type || 'lesson_plan',
    academicYear,
    term,
    weekNumber:  weekNumber ? Number(weekNumber) : undefined,
    imageUrl,
    imagePublicId,
  });

  return sendSuccess(res, { plan }, 201);
});

// GET /lesson-plans
export const listLessonPlans = asyncHandler(async (req, res) => {
  const { academicYear, term, teacherId, classId, type } = req.query;
  const filter = { schoolId: req.user.schoolId };

  if (academicYear) filter.academicYear = academicYear;
  if (term)         filter.term         = term;
  if (classId)      filter.classId      = classId;
  if (type)         filter.type         = type;

  // Teachers only see their own + shared; admins see all
  if (!VIEWER_ROLES.includes(req.user.role)) {
    filter.$or = [
      { teacherId: req.user._id },
      { sharedWith: req.user._id },
    ];
    if (teacherId && String(teacherId) === String(req.user._id)) {
      delete filter.$or;
      filter.teacherId = req.user._id;
    }
  } else if (teacherId) {
    filter.teacherId = teacherId;
  }

  const plans = await LessonPlan.find(filter)
    .populate('teacherId', 'firstName lastName staffId')
    .populate('classId',   'name stream')
    .populate('subjectId', 'name')
    .populate('sharedWith', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, { plans, total: plans.length });
});

// GET /lesson-plans/:id
export const getLessonPlan = asyncHandler(async (req, res) => {
  const plan = await LessonPlan.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
    .populate('teacherId', 'firstName lastName staffId')
    .populate('classId',   'name stream')
    .populate('subjectId', 'name')
    .populate('sharedWith', 'firstName lastName staffId')
    .lean();

  if (!plan) return sendError(res, 'Lesson plan not found.', 404);
  if (!canView(req.user, plan)) return sendForbidden(res, 'You do not have access to this lesson plan.');

  return sendSuccess(res, { plan });
});

// DELETE /lesson-plans/:id — owner or admin
export const deleteLessonPlan = asyncHandler(async (req, res) => {
  const plan = await LessonPlan.findOne({ _id: req.params.id, schoolId: req.user.schoolId });

  if (!plan) return sendError(res, 'Lesson plan not found.', 404);

  const isOwner = String(plan.teacherId) === String(req.user._id);
  const isAdmin = VIEWER_ROLES.includes(req.user.role);
  if (!isOwner && !isAdmin) return sendForbidden(res, 'Only the owner or an administrator can delete this plan.');

  if (plan.imagePublicId) {
    await deleteFile(plan.imagePublicId, { resource_type: 'image' });
  }

  await plan.deleteOne();
  return sendSuccess(res, { message: 'Lesson plan deleted.' });
});

// POST /lesson-plans/:id/share — admin/headteacher only
export const shareLessonPlan = asyncHandler(async (req, res) => {
  if (!SHARER_ROLES.includes(req.user.role)) {
    return sendForbidden(res, 'Only school administrators can share lesson plans.');
  }

  const { teacherId } = req.body;
  if (!teacherId) return sendError(res, 'teacherId is required.', 400);

  const [plan, teacher] = await Promise.all([
    LessonPlan.findOne({ _id: req.params.id, schoolId: req.user.schoolId }),
    User.findOne({ _id: teacherId, schoolId: req.user.schoolId, isActive: true }),
  ]);

  if (!plan)    return sendError(res, 'Lesson plan not found.', 404);
  if (!teacher) return sendError(res, 'Teacher not found in this school.', 404);

  const alreadyShared = plan.sharedWith.some((id) => String(id) === String(teacherId));
  if (!alreadyShared) {
    plan.sharedWith.push(teacherId);
    await plan.save();
  }

  return sendSuccess(res, { message: `Lesson plan shared with ${teacher.firstName} ${teacher.lastName}.` });
});

// DELETE /lesson-plans/:id/share/:teacherId — unshare
export const unshareLessonPlan = asyncHandler(async (req, res) => {
  if (!SHARER_ROLES.includes(req.user.role)) {
    return sendForbidden(res, 'Only school administrators can manage lesson plan access.');
  }

  const plan = await LessonPlan.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
  if (!plan) return sendError(res, 'Lesson plan not found.', 404);

  plan.sharedWith = plan.sharedWith.filter((id) => String(id) !== req.params.teacherId);
  await plan.save();

  return sendSuccess(res, { message: 'Access removed.' });
});
