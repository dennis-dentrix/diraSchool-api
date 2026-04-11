import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const objectIdRegex = /^[a-f\d]{24}$/i;

const createSubjectSchema = z
  .object({
    classId: z.string().regex(objectIdRegex, 'Invalid class ID'),
    name: z.string().trim().min(1, 'Subject name is required'),
    code: z.string().trim().min(1, 'Subject code is required').max(20).optional(),
  })
  .strict();

const updateSubjectSchema = z
  .object({
    classId: z.string().regex(objectIdRegex, 'Invalid class ID').optional(),
    name: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).max(20).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const listSubjectsSchema = z.object({
  classId: z.string().regex(objectIdRegex, 'Invalid class ID').optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
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

export const validateCreateSubject = validateBody(createSubjectSchema);
export const validateUpdateSubject = validateBody(updateSubjectSchema);
export const validateListSubjects = validateQuery(listSubjectsSchema);
