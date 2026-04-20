import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { TERMS, PAYMENT_METHODS } from '../../constants/index.js';
import { objectIdRegex, yearRegex } from '@diraschool/shared/schemas';

// ── Fee Structure ─────────────────────────────────────────────────────────────

const feeItemSchema = z.object({
  category: z.string().trim().optional(),
  name: z.string().trim().min(1, 'Fee item name is required'),
  amount: z.number().min(0, 'Fee item amount cannot be negative'),
});

const createFeeStructureSchema = z.object({
  classId: z.string().regex(objectIdRegex, 'Invalid class ID'),
  academicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year'),
  term: z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
  items: z.array(feeItemSchema).min(1, 'At least one fee item is required'),
  notes: z.string().trim().optional(),
});

const updateFeeStructureSchema = z.object({
  items: z.array(feeItemSchema).min(1, 'At least one fee item is required').optional(),
  notes: z.string().trim().optional(),
});

const listFeeStructuresSchema = z.object({
  classId: z.string().regex(objectIdRegex).optional(),
  academicYear: z.string().regex(yearRegex).optional(),
  term: z.enum(TERMS).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

// ── Payments ──────────────────────────────────────────────────────────────────

const createPaymentSchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID'),
  academicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year'),
  term: z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
  amount: z.number().min(1, 'Payment amount must be at least 1'),
  method: z.enum(Object.values(PAYMENT_METHODS), {
    message: `Method must be one of: ${Object.values(PAYMENT_METHODS).join(', ')}`,
  }),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  paymentDate: z.string().optional(),
}).strict();

const reversePaymentSchema = z.object({
  reversalReason: z.string().trim().min(1, 'Reversal reason is required'),
}).strict();

const listPaymentsSchema = z.object({
  studentId: z.string().regex(objectIdRegex).optional(),
  classId: z.string().regex(objectIdRegex).optional(),
  academicYear: z.string().regex(yearRegex).optional(),
  term: z.enum(TERMS).optional(),
  method: z.enum(Object.values(PAYMENT_METHODS)).optional(),
  status: z.enum(['completed', 'reversed']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const balanceQuerySchema = z.object({
  studentId: z.string().regex(objectIdRegex, 'Invalid student ID'),
  academicYear: z.string().regex(yearRegex, 'Academic year must be a 4-digit year'),
  term: z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` }),
});

const financeDashboardSummaryQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
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

export const validateCreateFeeStructure = validateBody(createFeeStructureSchema);
export const validateUpdateFeeStructure = validateBody(updateFeeStructureSchema);
export const validateListFeeStructures = validateQuery(listFeeStructuresSchema);

export const validateCreatePayment = validateBody(createPaymentSchema);
export const validateReversePayment = validateBody(reversePaymentSchema);
export const validateListPayments = validateQuery(listPaymentsSchema);
export const validateBalanceQuery = validateQuery(balanceQuerySchema);
export const validateFinanceDashboardSummaryQuery = validateQuery(financeDashboardSummaryQuerySchema);
