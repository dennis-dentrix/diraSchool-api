/**
 * Environment variable validation.
 * The process exits immediately with a clear error if a required variable is missing.
 * This prevents the server starting in a broken state with missing secrets.
 */

// These MUST be set in the deployment environment — no fallbacks allowed.
const required = [
  'MONGO_URI',
  'JWT_SECRET',
  'CLIENT_URL',
  'REDIS_URL',
  // AT_USERNAME / AT_API_KEY are optional until the SMS feature is activated
];

const writeStderr = (message) => {
  process.stderr.write(`${message}\n`);
};

export const validateEnv = () => {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    // USED THIS INSTEAD OF CONSOLE.ERROR DUE TO A WARNING FROM ESLINT
    writeStderr(`\n[ENV ERROR] Missing required environment variables:\n  ${missing.join('\n  ')}`);
    writeStderr('\nCopy .env.example to .env and fill in all required values.\n');
    process.exit(1);
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    writeStderr('\n[ENV ERROR] JWT_SECRET must be at least 32 characters.\n');
    process.exit(1);
  }

  if (!process.env.ZEPTOMAIL_API_KEY && !process.env.RESEND_API_KEY) {
    writeStderr(
      '\n[ENV ERROR] Configure at least one email provider: ZEPTOMAIL_API_KEY or RESEND_API_KEY.\n'
    );
    process.exit(1);
  }

  if (
    process.env.EMAIL_PRIMARY_PROVIDER &&
    !['zeptomail', 'resend'].includes(process.env.EMAIL_PRIMARY_PROVIDER)
  ) {
    writeStderr('\n[ENV ERROR] EMAIL_PRIMARY_PROVIDER must be either "zeptomail" or "resend".\n');
    process.exit(1);
  }
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  // No fallback — must be set explicitly in every environment
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1d',
  CLIENT_URL: process.env.CLIENT_URL,
  CLIENT_URL_STAGING: process.env.CLIENT_URL_STAGING,
  REDIS_URL: process.env.REDIS_URL,
  // AfricasTalking — optional until SMS feature is activated
  AT_USERNAME: process.env.AT_USERNAME,
  AT_API_KEY: process.env.AT_API_KEY,
  AT_SENDER_ID: process.env.AT_SENDER_ID || 'SCHOOL',
  // Email provider routing:
  // - EMAIL_PRIMARY_PROVIDER: zeptomail | resend
  // - EMAIL_FAILOVER_ENABLED: true | false
  // Set both provider keys for automatic failover.
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_PRIMARY_PROVIDER: process.env.EMAIL_PRIMARY_PROVIDER || 'zeptomail',
  EMAIL_FAILOVER_ENABLED: process.env.EMAIL_FAILOVER_ENABLED !== 'false',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  ZEPTOMAIL_SERVER: process.env.ZEPTOMAIL_SERVER || 'smtp.zeptomail.com',
  ZEPTOMAIL_USERNAME: process.env.ZEPTOMAIL_USERNAME || 'emailapikey',
  ZEPTOMAIL_API_KEY: process.env.ZEPTOMAIL_API_KEY,
  // Cloudinary — optional, PDF uploads skipped when not set
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  // Monitoring — optional
  SENTRY_DSN: process.env.SENTRY_DSN,
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};
