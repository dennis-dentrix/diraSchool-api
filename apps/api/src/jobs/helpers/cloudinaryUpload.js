/**
 * Cloudinary upload helper.
 *
 * Uses lazy initialization so Cloudinary is configured on first use, not at
 * module load time. This avoids env-loading race conditions and makes the
 * module safe to import before dotenv has been called.
 *
 * Returns null (never throws) when CLOUDINARY_* env vars are absent — callers
 * treat null as "upload skipped" and handle gracefully.
 */
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  configured = true;
  return true;
}

/**
 * Upload a buffer to Cloudinary.
 *
 * @param {Buffer} buffer   - File bytes to upload.
 * @param {object} options  - Cloudinary upload options (folder, resource_type, public_id, …).
 * @returns {Promise<{ url: string, publicId: string } | null>}
 *   Resolves to the upload result, or null when Cloudinary is not configured.
 */
export const uploadBuffer = (buffer, options = {}) => {
  if (!ensureConfigured()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
};

/**
 * Delete a file from Cloudinary by its public ID.
 *
 * @param {string} publicId     - The Cloudinary public ID to delete.
 * @param {object} [options]    - Optional Cloudinary destroy options (resource_type, etc.).
 * @returns {Promise<object | null>}
 */
export const deleteFile = (publicId, options = {}) => {
  if (!ensureConfigured()) return Promise.resolve(null);
  return cloudinary.uploader.destroy(publicId, { resource_type: 'raw', ...options });
};
