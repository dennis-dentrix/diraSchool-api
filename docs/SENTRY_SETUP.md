# Sentry Setup (API + Web)

There was no existing error monitoring SaaS in this codebase before this setup.
Current logging (`winston` files/console) remains useful, but it is not a replacement for centralized error alerting and trace correlation.

## API (`apps/api`)

Set in production:

- `SENTRY_DSN`
- Optional: `SENTRY_TRACES_SAMPLE_RATE` (default `0.1`)

Behavior:

- Captures server 5xx exceptions from the global error handler
- Captures worker failures and unhandled process exceptions
- Disabled automatically when `SENTRY_DSN` is missing

## Web (`apps/web`)

Set in production:

- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN` (for server-side Next errors; can be same DSN)
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN` (for source map upload during build)
- Optional:
  - `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default `0.1`)
  - `NEXT_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE` (default `0.0`)
  - `NEXT_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE` (default `1.0`)

Behavior:

- Captures client runtime errors (including app error boundaries)
- Captures Next server/edge runtime errors
- Keeps monitoring off when DSN vars are absent

## Deploy checklist

1. Add env vars to your server/platform.
2. Health-check the API on `/health` (not `/api/v1/health`).
   - Example: `curl -s http://127.0.0.1:3000/health`
3. Restart processes:
   - API: `pm2 restart diraschool-api --update-env`
   - Worker: `pm2 restart diraschool-worker --update-env`
   - Web: restart/build web process with new env.
4. Trigger a test error in staging and confirm it appears in Sentry.

## Safe test endpoint

Superadmin-only endpoint:

- `POST /api/v1/admin/monitoring-test`

Safety behavior:

- Disabled in production by default
- To allow temporarily in production, set:
  - `SENTRY_ALLOW_PROD_TEST_ENDPOINT=true`
