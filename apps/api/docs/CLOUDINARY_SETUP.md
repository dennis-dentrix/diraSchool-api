# Cloudinary Setup (DigitalOcean + PM2)

This project uses Cloudinary for:
- Student photo uploads
- Report card PDF storage
- Receipt PDF storage

## 1) Required environment variables

Set these on the API host:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Important: set all three together. Partial config is now treated as invalid startup config.

## 2) Ensure API and worker both see the same env

Report card/receipt generation is asynchronous (BullMQ), so **worker must run** and must have the same Cloudinary env values as API.

PM2 processes to run:
- `diraschool-api` (`src/server.js`)
- `diraschool-worker` (`src/jobs/worker.entry.js`)

## 3) Verify Cloudinary credentials from the API workspace

```bash
cd /var/www/diraschool/apps/api
npm run verify:cloudinary
```

Expected output:

```text
[Cloudinary Verify] Success: ok
```

## 4) Verify runtime health endpoint

```bash
curl -s http://127.0.0.1:5000/health
```

`services.cloudinary` should be `configured`.

## 5) PM2 restart (after env update)

```bash
pm2 restart diraschool-api --update-env
pm2 restart diraschool-worker --update-env
pm2 logs diraschool-api --lines 100
pm2 logs diraschool-worker --lines 100
```

## 6) Functional smoke test

1. Upload a student photo from student details page.
2. Generate a report card PDF from report cards page.
3. Confirm the PDF status transitions:
   - `queued` -> `processing` -> `ready`
4. Click `Download PDF` from the UI.

If status becomes `failed`, check worker logs first.
