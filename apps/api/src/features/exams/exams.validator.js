import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { EXAM_TYPES } from '../../constants/index.js';

const objectIdRegex = /^[a-f\d]{24}$/i;

const createExamSchema = z.object({
  classId:    z.string().regex(objectIdRegex, 'Invalid class ID'),
  subjectId:  z.string().regex(objectIdRegex, 'Invalid subject ID'),
  name:       z.string().trim().min(1, 'Exam name is required'),
  type:       z.enum(Object.values(EXAM_TYPES), {
    message: `Exam type must be one of: ${Object.values(EXAM_TYPES).join(', ')}`,
  }),
  totalMarks: z.coerce.number().positive('Total marks must be greater than 0'),
  // term and academicYear come from the class — frontend may send them; we ignore them.
  term:         z.string().optional(),
  academicYear: z.string().optional(),
});

const updateExamSchema = z.object({
  name:        z.string().trim().min(1).optional(),
  type:        z.enum(Object.values(EXAM_TYPES)).optional(),
  totalMarks:  z.coerce.number().positive().optional(),
  isPublished: z.boolean().optional(),
});

const listExamsSchema = z.object({
  classId: z.string().regex(objectIdRegex, 'Invalid class ID').optional(),
  subjectId: z.string().regex(objectIdRegex, 'Invalid subject ID').optional(),
  type: z.enum(Object.values(EXAM_TYPES)).optional(),
  term: z.string().optional(),
  academicYear: z.string().regex(/^\d{4}$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return sendError(res, result.error.errors[0].message, 400);
  req.body = result.data;
  next();
};

const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) return sendError(res, result.error.errors[0].message, 400);
  req.query = result.data;
  next();
};

export const validateCreateExam = validateBody(createExamSchema);
export const validateUpdateExam = validateBody(updateExamSchema);
export const validateListExams = validateQuery(listExamsSchema);
