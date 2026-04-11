import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { TERMS, DAYS_OF_WEEK } from '../../constants/index.js';

const objectIdRegex = /^[a-f\d]{24}$/i;
const yearRegex     = /^\d{4}$/;
const timeRegex     = /^\d{2}:\d{2}$/;

// ── Slot sub-schema ───────────────────────────────────────────────────────────

const slotSchema = z.object({
  day:       z.enum(DAYS_OF_WEEK, { message: `Day must be one of: ${DAYS_OF_WEEK.join(', ')}` }),
  period:    z.number().int().min(1).max(12),
  startTime: z.string().regex(timeRegex, 'startTime must be HH:MM'),
  endTime:   z.string().regex(timeRegex, 'endTime must be HH:MM'),
  subjectId: z.string().regex(objectIdRegex, 'Invalid subject ID').optional(),
  teacherId: z.string().regex(objectIdRegex, 'Invalid teacher ID').optional(),
  room:      z.string().trim().optional(),
});

// ── Create timetable ──────────────────────────────────────────────────────────

const createTimetableSchema = z.object({
  classId:      z.string().regex(objectIdRegex, 'Invalid class ID'),
  academicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year'),
  term:         z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
  slots:        z.array(slotSchema).optional(),
}).strict();

// ── Update slots (full replace) ───────────────────────────────────────────────

const updateSlotsSchema = z.object({
  slots: z.array(slotSchema).min(1, 'At least one slot is required'),
}).strict();

// ── List query ────────────────────────────────────────────────────────────────

const listTimetablesSchema = z.object({
  classId:      z.string().regex(objectIdRegex).optional(),
  academicYear: z.string().regex(yearRegex).optional(),
  term:         z.enum(TERMS).optional(),
  page:         z.coerce.number().int().positive().optional(),
  limit:        z.coerce.number().int().positive().optional(),
});

// ── Middleware factories ───────────────────────────────────────────────────────

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

export const validateCreateTimetable  = validateBody(createTimetableSchema);
export const validateUpdateSlots      = validateBody(updateSlotsSchema);
export const validateListTimetables   = validateQuery(listTimetablesSchema);
