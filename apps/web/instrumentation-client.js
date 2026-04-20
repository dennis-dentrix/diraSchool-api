import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],
  replaysSessionSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? 0.0),
  replaysOnErrorSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE ?? 1.0),
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
