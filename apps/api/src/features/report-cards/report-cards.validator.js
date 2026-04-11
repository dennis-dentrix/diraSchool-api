import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { TERMS } from '../../constants/index.js';

const objectIdRegex = /^[a-f\d]{24}$/i;
const yearRegex = /^\d{4}$/;

const generateSchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID'),
  academicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year'),
  term: z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
}).strict();

const generateClassSchema = z.object({
  classId: z.string().regex(objectIdRegex, 'Invalid class ID'),
  academicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year'),
  term: z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
}).strict();

const remarksSchema = z.object({
  teacherRemarks: z.string().trim().optional(),
  principalRemarks: z.string().trim().optional(),
}).strict().refine(
  (data) => data.teacherRemarks !== undefined || data.principalRemarks !== undefined,
  { message: 'At least one of teacherRemarks or principalRemarks is required.' }
);

const listReportCardsSchema = z.object({
  classId: z.string().regex(objectIdRegex).optional(),
  studentId: z.string().regex(objectIdRegex).optional(),
  academicYear: z.string().regex(yearRegex).optional(),
  term: z.enum(TERMS).optional(),
  status: z.enum(['draft', 'published']).optional(),
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

const subjectRemarkSchema = z.object({
  // Empty string or null → clears the remark. Any non-empty string → sets it.
  remark: z.string().trim().max(500, 'Remark must be 500 characters or fewer').nullable().optional(),
}).strict();

export const validateGenerate = validateBody(generateSchema);
export const validateGenerateClass = validateBody(generateClassSchema);
export const validateRemarks = validateBody(remarksSchema);
export const validateSubjectRemark = validateBody(subjectRemarkSchema);
export const validateListReportCards = validateQuery(listReportCardsSchema);
