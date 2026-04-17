import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const objectIdRegex = /^[a-f\d]{24}$/i;

const resultEntrySchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID'),
  marks: z.number().min(0, 'Marks cannot be negative'),
});

const hasUniqueStudents = (entries = []) => {
  const unique = new Set(entries.map((entry) => entry.studentId));
  return unique.size === entries.length;
};

const bulkUpsertResultsSchema = z.object({
  examId: z.string().regex(objectIdRegex, 'Invalid exam ID'),
  classId: z.string().regex(objectIdRegex).optional(), // allowed passthrough — ignored by controller
  entries: z.array(resultEntrySchema).min(1, 'At least one result entry is required'),
}).refine((data) => hasUniqueStudents(data.entries), {
  message: 'Each student can appear only once in result entries.',
  path: ['entries'],
});

const updateResultSchema = z.object({
  marks: z.number().min(0, 'Marks cannot be negative'),
}).strict();

const listResultsSchema = z.object({
  examId: z.string().regex(objectIdRegex, 'Invalid exam ID').optional(),
  classId: z.string().regex(objectIdRegex, 'Invalid class ID').optional(),
  subjectId: z.string().regex(objectIdRegex, 'Invalid subject ID').optional(),
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID').optional(),
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

export const validateBulkUpsertResults = validateBody(bulkUpsertResultsSchema);
export const validateUpdateResult = validateBody(updateResultSchema);
export const validateListResults = validateQuery(listResultsSchema);
