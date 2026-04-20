import * as Sentry from '@sentry/node';
import { env } from './env.js';

const hasDsn = !!env.SENTRY_DSN;
let started = false;

export const initSentry = (serviceName = 'diraschool-api') => {
  if (!hasDsn || started) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.npm_package_version,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    serverName: serviceName,
  });

  started = true;
};

export const captureError = (error, context = {}) => {
  if (!hasDsn) return null;
  let eventId = null;
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    eventId = Sentry.captureException(error);
  });
  return eventId;
};

export const sentryEnabled = hasDsn;
