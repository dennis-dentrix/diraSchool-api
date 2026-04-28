import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../../config/env.js';

let _client = null;

function isConfigured() {
  return !!(env.DO_SPACES_KEY && env.DO_SPACES_SECRET && env.DO_SPACES_BUCKET && env.DO_SPACES_REGION);
}

function getClient() {
  if (_client) return _client;
  _client = new S3Client({
    endpoint: `https://${env.DO_SPACES_REGION}.digitaloceanspaces.com`,
    region: env.DO_SPACES_REGION,
    credentials: {
      accessKeyId: env.DO_SPACES_KEY,
      secretAccessKey: env.DO_SPACES_SECRET,
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
  if (env.DO_SPACES_CDN_ENDPOINT) return `${env.DO_SPACES_CDN_ENDPOINT}/${key}`;
  return `https://${env.DO_SPACES_BUCKET}.${env.DO_SPACES_REGION}.digitaloceanspaces.com/${key}`;
}

/**
 * Upload a buffer to DigitalOcean Spaces.
 * Drop-in replacement for cloudinaryUpload.uploadBuffer.
 *
 * @param {Buffer} buffer
 * @param {object} options  — folder, public_id, resource_type, format, overwrite (ignored — S3 overwrites by default)
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
    // Set Content-Disposition at rest so every download works without URL tricks
    contentDisposition = `attachment; filename="${public_id}.pdf"`;
  }

  const key = buildKey(folder, public_id, resource_type, format);

  await getClient().send(new PutObjectCommand({
    Bucket: env.DO_SPACES_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentDisposition: contentDisposition,
    ACL: 'public-read',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  return { url: buildUrl(key), publicId: key };
}

/**
 * Delete a file from DigitalOcean Spaces by its key (publicId).
 * Drop-in replacement for cloudinaryUpload.deleteFile.
 *
 * @param {string} publicId — the full S3 key returned by uploadBuffer
 */
export async function deleteFile(publicId) {
  if (!isConfigured() || !publicId) return null;
  await getClient().send(new DeleteObjectCommand({
    Bucket: env.DO_SPACES_BUCKET,
    Key: publicId,
  }));
}
