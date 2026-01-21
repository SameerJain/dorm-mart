# Railway Deployment Guide

## Quick Setup

### 1. Add MySQL Database
- In Railway dashboard, click "+ New" → "Database" → "MySQL"
- Railway will create a MySQL database automatically

### 2. Set Environment Variables
In your **web service** (not the database), set these variables:

**Database Connection** (get from MySQL service → "Connect" tab):
- `DB_HOST` = `containers-us-west-XXX.railway.app` (or the hostname Railway gives you)
- `DB_NAME` = Your database name (Railway creates one, or set your own)
- `DB_USERNAME` = `root` (or the username Railway gives you)
- `DB_PASSWORD` = (the password Railway gives you)

**Application URLs**:
- `FRONTEND_BASE_URL` = `https://your-app-name.up.railway.app` (Railway will give you this URL)
- `REACT_APP_API_BASE` = `/api` (for React build)

**Optional**:
- `CORS_ALLOWED_ORIGINS` = `https://your-app-name.up.railway.app` (if needed)

### 3. Set Build Command
In your web service → Settings → Build:
- Build Command: `PUBLIC_URL=/ REACT_APP_API_BASE=/api npm run build`

### 4. Run Database Migrations
After deployment, you can run migrations via Railway's CLI or by creating a one-time service:

**Option A: Railway CLI** (recommended)
```bash
railway run php api/database/migrate_schema.php
railway run php api/database/migrate_data.php
```

**Option B: One-time service**
- Create a temporary service that runs migrations
- Or SSH into your service and run migrations manually

### 5. Access Database (like phpMyAdmin)

**Option A: Railway's Built-in Query Tool**
- Go to MySQL service → "Query" tab
- Run SQL queries directly

**Option B: Desktop MySQL Client**
- MySQL Workbench, DBeaver, or TablePlus
- Use connection details from MySQL service → "Connect" tab

**Option C: phpMyAdmin Service**
- Add phpMyAdmin as a separate Railway service
- See `phpmyadmin/` directory for Dockerfile setup

## Files Needed

- ✅ `Procfile` - Tells Railway how to start
- ✅ `router.php` - Routes API requests and serves React
- ✅ `composer.json` - Railway auto-detects PHP
- ✅ `package.json` - Railway auto-detects Node.js
- ✅ Updated `load_env.php` - Works with Railway env vars

## Deployment Flow

1. Push code to GitHub
2. Railway auto-detects and builds
3. Set environment variables in dashboard
4. Run migrations
5. Your app is live!

## Troubleshooting

- **Build fails?** Check that `REACT_APP_API_BASE` is set in build command
- **Database connection fails?** Check environment variables match MySQL service
- **API returns 404?** Check `router.php` is routing correctly
- **React app doesn't load?** Check `FRONTEND_BASE_URL` is set correctly
