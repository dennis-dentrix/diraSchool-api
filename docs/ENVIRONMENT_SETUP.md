# Environment Setup

Use these templates as the single source of truth.

## API (`apps/api`)

- Local/dev template: `apps/api/.env.example` -> copy to `apps/api/.env`
- Production template: `apps/api/.env.production.example`

Required for API startup:

- `MONGO_URI`
- `REDIS_URL`
- `JWT_SECRET` (minimum 32 chars)
- `CLIENT_URL`
- At least one email provider key:
  - `ZEPTOMAIL_API_KEY` or
  - `RESEND_API_KEY`

## Web (`apps/web`)

- Local/dev template: `apps/web/.env.local.example` -> copy to `apps/web/.env.local`
- Production template: `apps/web/.env.production.example`

Required for web runtime:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_APP_URL`

Sentry variables are optional for both API and Web.
