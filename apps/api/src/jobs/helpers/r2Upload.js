import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../../config/env.js';

let _client = null;

function isConfigured() {
  return !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET && env.R2_ENDPOINT);
}

function getClient() {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: env.R2_ENDPOINT,
    region: 'auto', // R2 always uses 'auto'
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

function buildKey(folder, publicId, resourceType, format) {
  const base = folder ? `${folder}/${publicId}` : publicId;
  if (format)                    return `${base}.${format}`;
  if (resourceType === 'image')  return `${base}.jpg`;
  return base;
}

function buildUrl(key) {
  // R2_PUBLIC_URL — custom domain or R2.dev public bucket URL (recommended)
  if (env.R2_PUBLIC_URL) return `${env.R2_PUBLIC_URL}/${key}`;
  // Fallback: direct account endpoint (requires bucket to have public access enabled)
  return `${env.R2_ENDPOINT}/${env.R2_BUCKET}/${key}`;
}

/**
 * Upload a buffer to Cloudflare R2.
 *
 * @param {Buffer} buffer
 * @param {object} options  — folder, public_id, resource_type, format
 * @returns {Promise<{ url: string, publicId: string } | null>}
 */
export async function uploadBuffer(buffer, options = {}) {
  if (!isConfigured()) return null;

  const { folder, public_id, resource_type = 'auto', format } = options;

  let body = buffer;
  let contentType = 'application/octet-stream';
  let contentDisposition = 'inline';

  if (resource_type === 'image' || (resource_type === 'auto' && !format)) {
    body = await sharp(buffer)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
    contentType = 'image/jpeg';
  } else if (format === 'pdf' || resource_type === 'raw') {
    contentType = 'application/pdf';
    contentDisposition = `attachment; filename="${public_id}.pdf"`;
  }

  const key = buildKey(folder, public_id, resource_type, format);

  await getClient().send(new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentDisposition: contentDisposition,
    // R2 does not support S3 ACLs — public access is controlled at the bucket level in the dashboard
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { url: buildUrl(key), publicId: key };
}

/**
 * Delete a file from Cloudflare R2 by its key (publicId).
 *
 * @param {string} publicId — the full R2 object key returned by uploadBuffer
 */
export async function deleteFile(publicId) {
  if (!isConfigured() || !publicId) return null;
  await getClient().send(new DeleteObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: publicId,
  }));
}
