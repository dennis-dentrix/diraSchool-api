import { z } from 'zod';
import { sendError } from '../../utils/response.js';

const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return sendError(res, result.error.errors.map((e) => e.message).join(', '), 400);
  }
  req.body = result.data;
  return next();
};

const checkInSchema = z.object({
  // Location is optional for devices without GPS or when location unavailable
  latitude:         z.number().optional(),
  longitude:        z.number().optional(),
  accuracy:         z.number().positive().optional(),
  check_in_type:    z.enum(['morning_in', 'evening_out']).default('morning_in'),
  off_site_reason:  z.string().trim().max(500).optional(),
  synced_offline:   z.boolean().optional().default(false),
  client_timestamp: z.string().datetime().optional(),
});

const geofenceSchema = z.object({
  latitude:      z.number({ required_error: 'latitude is required' }),
  longitude:     z.number({ required_error: 'longitude is required' }),
  radius_meters: z.number().int().min(50).max(500).default(150),
});

const checkInTimeSchema = z.object({
  checkInDeadline: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
  checkOutTime:    z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format').optional(),
});

export const validateCheckIn      = validateBody(checkInSchema);
export const validateGeofence     = validateBody(geofenceSchema);
export const validateCheckInTimes = validateBody(checkInTimeSchema);
