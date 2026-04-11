/**
 * Multer configuration for in-memory file uploads.
 *
 * Only used for CSV import. Files are held in memory as a Buffer
 * (req.file.buffer) — no disk I/O, no temp-file cleanup required.
 *
 * Limits:
 *   - Max file size: 5 MB (protects against large malicious uploads)
 *   - Allowed mime type: text/csv or application/vnd.ms-excel
 */
import multer from 'multer';
import { sendError } from '../utils/response.js';

const ALLOWED_MIME = new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain']);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (
    ALLOWED_MIME.has(file.mimetype) ||
    file.originalname.endsWith('.csv')
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter,
});

/**
 * Single-file upload middleware for CSV imports.
 * Field name must be "file".
 * Wraps multer errors into the standard API error response format.
 */
export const uploadCsv = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 'CSV file must be 5 MB or smaller.', 400);
      }
      return sendError(res, err.message, 400);
    }
    if (err) {
      return sendError(res, err.message, 400);
    }
    if (!req.file) {
      return sendError(res, 'A CSV file is required (field name: "file").', 400);
    }
    next();
  });
};
