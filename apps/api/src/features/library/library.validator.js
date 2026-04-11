import { z } from 'zod';
import { sendError } from '../../utils/response.js';
import { LOAN_STATUSES, BORROWER_TYPES } from '../../constants/index.js';

const objectIdRegex = /^[a-f\d]{24}$/i;

// ── Book ──────────────────────────────────────────────────────────────────────

const createBookSchema = z.object({
  title:        z.string().trim().min(1, 'Book title is required'),
  author:       z.string().trim().optional(),
  isbn:         z.string().trim().optional(),
  category:     z.string().trim().optional(),
  totalCopies:  z.number().int().min(1, 'Total copies must be at least 1'),
}).strict();

const updateBookSchema = z.object({
  title:        z.string().trim().min(1).optional(),
  author:       z.string().trim().optional(),
  isbn:         z.string().trim().optional(),
  category:     z.string().trim().optional(),
  totalCopies:  z.number().int().min(1).optional(),
  isActive:     z.boolean().optional(),
}).strict();

const listBooksSchema = z.object({
  category:  z.string().trim().optional(),
  isActive:  z.enum(['true', 'false']).optional(),
  search:    z.string().trim().optional(),
  page:      z.coerce.number().int().positive().optional(),
  limit:     z.coerce.number().int().positive().optional(),
});

// ── Loans ─────────────────────────────────────────────────────────────────────

const issueLoanSchema = z.object({
  bookId:       z.string().regex(objectIdRegex, 'Invalid book ID'),
  borrowerType: z.enum(Object.values(BORROWER_TYPES), {
    message: `borrowerType must be one of: ${Object.values(BORROWER_TYPES).join(', ')}`,
  }),
  borrowerId:   z.string().regex(objectIdRegex, 'Invalid borrower ID'),
  borrowerName: z.string().trim().optional(),
  dueDate:      z.coerce.date(),
  notes:        z.string().trim().optional(),
}).strict();

const returnBookSchema = z.object({
  notes: z.string().trim().optional(),
}).strict();

const listLoansSchema = z.object({
  bookId:       z.string().regex(objectIdRegex).optional(),
  borrowerId:   z.string().regex(objectIdRegex).optional(),
  borrowerType: z.enum(Object.values(BORROWER_TYPES)).optional(),
  status:       z.enum(Object.values(LOAN_STATUSES)).optional(),
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

export const validateCreateBook  = validateBody(createBookSchema);
export const validateUpdateBook  = validateBody(updateBookSchema);
export const validateListBooks   = validateQuery(listBooksSchema);
export const validateIssueLoan   = validateBody(issueLoanSchema);
export const validateReturnBook  = validateBody(returnBookSchema);
export const validateListLoans   = validateQuery(listLoansSchema);
