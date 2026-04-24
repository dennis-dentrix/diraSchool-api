import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const objectIdRegex = /^[a-f\d]{24}$/i;

const createSubjectSchema = z.object({
  classId:    z.string().regex(objectIdRegex, 'Invalid class ID'),
  name:       z.string().trim().min(1, 'Subject name is required'),
  code:       z.string().trim().min(1).max(20).optional(),
  department: z.string().trim().min(1).optional(),
  // Primary + additional teachers who can deliver this subject
  teacherIds: z.array(z.string().regex(objectIdRegex, 'Invalid teacher ID')).optional(),
  // Head of Department
  hodId:      z.string().regex(objectIdRegex, 'Invalid HOD ID').optional(),
});

const updateSubjectSchema = z.object({
  classId:    z.string().regex(objectIdRegex, 'Invalid class ID').optional(),
  name:       z.string().trim().min(1).optional(),
  code:       z.string().trim().min(1).max(20).nullable().optional(),
  isActive:   z.boolean().optional(),
  department: z.string().trim().min(1).nullable().optional(),
  teacherIds: z.array(z.string().regex(objectIdRegex, 'Invalid teacher ID')).optional(),
  hodId:      z.string().regex(objectIdRegex, 'Invalid HOD ID').nullable().optional(),
}).strict();

const assignTeachersSchema = z.object({
  // Full replacement of teacher list — send [] to clear all teachers
  teacherIds: z.array(z.string().regex(objectIdRegex, 'Invalid teacher ID')),
  hodId:      z.string().regex(objectIdRegex, 'Invalid HOD ID').nullable().optional(),
});

const listSubjectsSchema = z.object({
  classId:    z.string().regex(objectIdRegex, 'Invalid class ID').optional(),
  department: z.string().optional(),
  isActive:   z.enum(['true', 'false']).optional(),
  page:       z.coerce.number().int().positive().optional(),
  limit:      z.coerce.number().int().positive().optional(),
});

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, result.error.errors[0].message, 400);
  }
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return sendError(res, result.error.errors[0].message, 400);
  }
  req.query = result.data;
  next();
};

export const validateCreateSubject   = validateBody(createSubjectSchema);
export const validateUpdateSubject   = validateBody(updateSubjectSchema);
export const validateAssignTeachers  = validateBody(assignTeachersSchema);
export const validateListSubjects    = validateQuery(listSubjectsSchema);
