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
    process.env.NODE_ENV === 'production' &&
    process.env.CLIENT_URL &&
    process.env.CLIENT_URL.includes('localhost')
  ) {
    writeStderr(
      '\n[ENV WARNING] CLIENT_URL contains "localhost" in production — email links will point to localhost!\n' +
      `  Current value: ${process.env.CLIENT_URL}\n` +
      '  Set CLIENT_URL=https://diraschool.com in your .env file.\n'
    );
    // Non-fatal — warn but don't exit, so the server can still start
  }

  // DO Spaces — partial config is always a mistake
  const spacesVars = ['DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET', 'DO_SPACES_REGION'];
  const configuredSpacesVars = spacesVars.filter((key) => !!process.env[key]);
  if (configuredSpacesVars.length > 0 && configuredSpacesVars.length < spacesVars.length) {
    writeStderr(
      '\n[ENV ERROR] Partial DO Spaces configuration detected.\n' +
      'Set all 4 variables or none:\n' +
      '  DO_SPACES_KEY\n' +
      '  DO_SPACES_SECRET\n' +
      '  DO_SPACES_BUCKET\n' +
      '  DO_SPACES_REGION\n'
    );
    process.exit(1);
  }

  const pesapalVars = [
    'PESAPAL_CONSUMER_KEY',
    'PESAPAL_CONSUMER_SECRET',
    'PESAPAL_NOTIFICATION_ID',
  ];
  const configuredPesapalVars = pesapalVars.filter((key) => !!process.env[key]);
  if (configuredPesapalVars.length > 0 && configuredPesapalVars.length < pesapalVars.length) {
    writeStderr(
      '\n[ENV ERROR] Partial Pesapal configuration detected.\n' +
      'Set all variables or none:\n' +
      '  PESAPAL_CONSUMER_KEY\n' +
      '  PESAPAL_CONSUMER_SECRET\n' +
      '  PESAPAL_NOTIFICATION_ID\n'
    );
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
  // ZeptoMail is primary; Resend is automatic fallback when RESEND_API_KEY is set.
  EMAIL_FROM: process.env.EMAIL_FROM,
  ZEPTOMAIL_SERVER: process.env.ZEPTOMAIL_SERVER || 'smtp.zeptomail.com',
  ZEPTOMAIL_USERNAME: process.env.ZEPTOMAIL_USERNAME || 'emailapikey',
  ZEPTOMAIL_API_KEY: process.env.ZEPTOMAIL_API_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  DO_SPACES_KEY: process.env.DO_SPACES_KEY,
  DO_SPACES_SECRET: process.env.DO_SPACES_SECRET,
  DO_SPACES_BUCKET: process.env.DO_SPACES_BUCKET,
  DO_SPACES_REGION: process.env.DO_SPACES_REGION || 'ams3',
  DO_SPACES_CDN_ENDPOINT: process.env.DO_SPACES_CDN_ENDPOINT,
  // Monitoring — optional
  SENTRY_DSN: process.env.SENTRY_DSN,
  // Pesapal — optional. If keys are set, checkout endpoints can be enabled.
  PESAPAL_ENABLED: process.env.PESAPAL_ENABLED === 'true',
  PESAPAL_ENV: process.env.PESAPAL_ENV || 'sandbox',
  PESAPAL_BASE_URL: process.env.PESAPAL_BASE_URL,
  PESAPAL_CONSUMER_KEY: process.env.PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET: process.env.PESAPAL_CONSUMER_SECRET,
  PESAPAL_NOTIFICATION_ID: process.env.PESAPAL_NOTIFICATION_ID,
  PESAPAL_CURRENCY: process.env.PESAPAL_CURRENCY || 'KES',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
};
