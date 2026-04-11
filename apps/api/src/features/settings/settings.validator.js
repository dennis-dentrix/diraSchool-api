import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { TERMS, DAYS_OF_WEEK } from '../../constants/index.js';

const objectIdRegex = /^[a-f\d]{24}$/i;
const yearRegex     = /^\d{4}$/;

// ── Update Settings ───────────────────────────────────────────────────────────

const termDateSchema = z.object({
  name:      z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
  startDate: z.coerce.date(),
  endDate:   z.coerce.date(),
}).refine((t) => t.endDate > t.startDate, {
  message: 'endDate must be after startDate',
});

const updateSettingsSchema = z.object({
  currentAcademicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year').optional(),
  terms:               z.array(termDateSchema).max(3).optional(),
  workingDays: z
    .array(z.enum(DAYS_OF_WEEK, { message: `Each day must be one of: ${DAYS_OF_WEEK.join(', ')}` }))
    .min(1)
    .optional(),
  motto:           z.string().trim().optional(),
  principalName:   z.string().trim().optional(),
  physicalAddress: z.string().trim().optional(),
}).strict();

// ── Add Holiday ───────────────────────────────────────────────────────────────

const addHolidaySchema = z.object({
  name:        z.string().trim().min(1, 'Holiday name is required'),
  date:        z.coerce.date(),
  description: z.string().trim().optional(),
}).strict();

// ── Middleware factories ───────────────────────────────────────────────────────

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return sendError(res, result.error.errors[0].message, 400);
  req.body = result.data;
  next();
};

export const validateUpdateSettings = validateBody(updateSettingsSchema);
export const validateAddHoliday     = validateBody(addHolidaySchema);
