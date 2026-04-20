import { z } from 'zod';
import { TERMS } from './constants.js';

export const objectIdRegex = /^[a-f\d]{24}$/i;
export const yearRegex = /^\d{4}$/;

export const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ID');
export const academicYearSchema = z.string().regex(yearRegex, 'Academic year must be a 4-digit year');
export const termSchema = z.enum(TERMS, { message: `Term must be one of: ${TERMS.join(', ')}` });
