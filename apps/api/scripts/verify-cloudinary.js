import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  // eslint-disable-next-line no-console
  console.error(
    `[Cloudinary Verify] Missing env vars: ${missing.join(', ')}`
  );
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

try {
  const result = await cloudinary.api.ping();
  // eslint-disable-next-line no-console
  console.log('[Cloudinary Verify] Success:', result?.status ?? 'ok');
  process.exit(0);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[Cloudinary Verify] Failed:', err?.message ?? err);
  process.exit(1);
}
