import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const objectIdRegex = /^[a-f\d]{24}$/i;
const timeRegex     = /^\d{2}:\d{2}$/;

// ── Stop sub-schema ───────────────────────────────────────────────────────────

const stopSchema = z.object({
  name:  z.string().trim().min(1, 'Stop name is required'),
  order: z.coerce.number().int().min(1, 'Stop order must be at least 1'),
  lat:   z.coerce.number().optional(),
  lng:   z.coerce.number().optional(),
});

// ── Create Route ──────────────────────────────────────────────────────────────

const createRouteSchema = z.object({
  name:               z.string().trim().min(1, 'Route name is required'),
  description:        z.string().trim().optional(),
  vehicleReg:         z.string().trim().optional(),
  driverName:         z.string().trim().optional(),
  driverPhone:        z.string().trim().optional(),
  capacity:           z.coerce.number().int().min(1).optional(),
  stops:              z.array(stopSchema).optional(),
  morningDeparture:   z.string().regex(timeRegex, 'morningDeparture must be HH:MM').optional(),
  afternoonDeparture: z.string().regex(timeRegex, 'afternoonDeparture must be HH:MM').optional(),
});

// ── Update Route ──────────────────────────────────────────────────────────────

const updateRouteSchema = z.object({
  name:               z.string().trim().min(1).optional(),
  description:        z.string().trim().optional(),
  vehicleReg:         z.string().trim().optional(),
  driverName:         z.string().trim().optional(),
  driverPhone:        z.string().trim().optional(),
  capacity:           z.coerce.number().int().min(1).optional(),
  stops:              z.array(stopSchema).optional(),
  morningDeparture:   z.string().regex(timeRegex).optional(),
  afternoonDeparture: z.string().regex(timeRegex).optional(),
  isActive:           z.boolean().optional(),
}).strict();

// ── Assign / Unassign students ────────────────────────────────────────────────

const studentIdsSchema = z.object({
  studentIds: z
    .array(z.string().regex(objectIdRegex, 'Invalid student ID'))
    .min(1, 'At least one student ID is required'),
}).strict();

// ── List Routes ───────────────────────────────────────────────────────────────

const listRoutesSchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  page:     z.coerce.number().int().positive().optional(),
  limit:    z.coerce.number().int().positive().optional(),
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

export const validateCreateRoute    = validateBody(createRouteSchema);
export const validateUpdateRoute    = validateBody(updateRouteSchema);
export const validateStudentIds     = validateBody(studentIdsSchema);
export const validateListRoutes     = validateQuery(listRoutesSchema);
