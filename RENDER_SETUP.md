# Render.com Deployment Guide

This guide walks you through deploying the DiraSchool application to Render.com using Web Services (not Static Sites).

## Prerequisites

- GitHub account connected to Render
- Repository pushed to GitHub: https://github.com/dennis-dentrix/diraschool-api
- Two services needed: API and Web App

---

## Step 1: Delete the Static Site (Current Setup)

1. Go to https://dashboard.render.com
2. Click on your **Diraschool** service (the Static Site)
3. Scroll to bottom → Click **Settings**
4. Scroll to bottom → Click **Delete Service**
5. Confirm deletion

---

## Step 2: Create Web Service for the API

### 2a. Create New Service
1. Click **+ New** button
2. Select **Web Service**
3. Connect your GitHub repo: `dennis-dentrix/diraschool-api`
4. Select `main` branch

### 2b. Configure API Service
Fill in the following fields:

| Field | Value |
|-------|-------|
| **Name** | `diraschool-api` |
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start -w apps/api` |
| **Root Directory** | `/` (leave blank) |

### 2c. Add Environment Variables
Click **+ Add Environment Variable** for each:

```
MONGODB_URI = your-mongodb-uri
REDIS_URL = your-redis-url
NODE_ENV = production
JWT_SECRET = your-jwt-secret
```

*(Replace with your actual values)*

### 2d. Deploy
- Click **Create Web Service**
- Wait for build to complete
- Note the API URL (e.g., `https://diraschool-api.onrender.com`)

---

## Step 3: Create Web Service for the Web App

### 3a. Create New Service
1. Click **+ New** button
2. Select **Web Service**
3. Connect your GitHub repo: `dennis-dentrix/diraschool-api`
4. Select `main` branch

### 3b. Configure Web App Service
Fill in the following fields:

| Field | Value |
|-------|-------|
| **Name** | `diraschool` |
| **Environment** | `Node` |
| **Build Command** | `npm install && npm run build:web` |
| **Start Command** | `npm start -w apps/web` |
| **Root Directory** | `/` (leave blank) |

### 3c. Add Environment Variables
Click **+ Add Environment Variable**:

```
NEXT_PUBLIC_API_URL = https://diraschool-api.onrender.com
```

*(Use the API URL from Step 2d)*

### 3d. Deploy
- Click **Create Web Service**
- Wait for build to complete (~3-5 minutes)
- Your site will be live at `https://diraschool.onrender.com/`

---

## Step 4: Verify Deployment

### Test the API
```bash
curl https://diraschool-api.onrender.com/api/v1/health
```
Should return a health check response.

### Test the Web App
Visit: `https://diraschool.onrender.com/`
Should load without 404 error.

### Check Logs
1. Go to each service's dashboard
2. Click **Logs** tab
3. Look for any errors

---

## Troubleshooting

### Web App returns 404
- **Cause:** Usually a build error or wrong start command
- **Solution:** Check the **Logs** tab for build errors
- Ensure `NEXT_PUBLIC_API_URL` environment variable is set

### API not connecting to database
- **Cause:** Missing or wrong `MONGODB_URI` environment variable
- **Solution:** Set the environment variable in Render dashboard
- Ensure MongoDB allows connections from Render's IP

### Build timeout (>30 minutes)
- **Cause:** npm install taking too long
- **Solution:** This is normal for first build; it's cached afterward

### Port errors
- **Solution:** The `start.sh` script handles dynamic ports automatically. Don't hardcode ports.

---

## File Structure for Render

Your repo is a **monorepo** with this structure:

```
diraschool-api/
├── apps/
│   ├── api/          ← API service (Node.js/Express)
│   └── web/          ← Web service (Next.js)
├── render.yaml       ← Configuration (optional)
└── RENDER_SETUP.md   ← This file
```

Each service is deployed separately:
- **API Service:** Builds from `/apps/api`, runs `npm start`
- **Web Service:** Builds from `/apps/web`, runs `bash start.sh`

---

## Using render.yaml (Alternative)

You can skip the manual steps above by pushing a `render.yaml` file. See the repo root for the included `render.yaml` with full configuration.

To use it:
1. Ensure `render.yaml` is in repo root
2. In Render dashboard, it will detect and use this config automatically
3. Just click **Create Service** and select the service to deploy

---

## Environment Variables Reference

### Web App (.env for local development)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

### Web App (Render production)
```
NEXT_PUBLIC_API_URL=https://diraschool-api.onrender.com
```

### API (.env for local development)
```
MONGODB_URI=mongodb://localhost:27017/diraschool
REDIS_URL=redis://localhost:6379
NODE_ENV=development
JWT_SECRET=your-secret-key
```

### API (Render production)
```
MONGODB_URI=your-mongodb-atlas-uri
REDIS_URL=your-redis-url
NODE_ENV=production
JWT_SECRET=your-production-secret
```

---

## Next Steps

1. Follow Steps 1-4 above
2. Once deployed, monitor logs for any errors
3. Test all critical features (login, payments, etc.)
4. Set up custom domain (optional)

---

## Support

For Render-specific issues:
- [Render Documentation](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [Next.js on Render](https://render.com/docs/deploy-next)
