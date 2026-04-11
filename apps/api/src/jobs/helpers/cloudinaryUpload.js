/**
 * Thin wrapper around Cloudinary's upload_stream.
 * Only uploads if all three CLOUDINARY_* env vars are configured.
 * Returns { url, publicId } or null when Cloudinary is not configured.
 */
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';

let configured = false;

if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key:    env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

/**
 * @param {Buffer} buffer  — file bytes to upload
 * @param {Object} options — Cloudinary upload options (folder, resource_type, public_id, …)
 * @returns {Promise<{url:string, publicId:string}|null>}
 */
export const uploadBuffer = (buffer, options = {}) => {
  if (!configured) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: 'raw', ...options },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};
