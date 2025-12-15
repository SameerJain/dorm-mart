# Quick Start

**Note:** This project requires environment configuration.

1. Clone the repository and navigate to the `dorm-mart` directory
2. Run `npm install` to install dependencies
3. **Set up environment variables**: Copy `.env.development.example` to `.env.development` and configure:
   - Database credentials (DB_HOST, DB_NAME, DB_USERNAME, DB_PASSWORD)
   - Frontend URL (FRONTEND_BASE_URL) - defaults to `http://localhost:3000` for development
   - Email credentials (GMAIL_USERNAME, GMAIL_PASSWORD) for password reset emails
   - See `.env.example` for all available options
4. Set up your local database (see schema migration details below)
5. Start the development server: `npm run start-local-win` (or `-mac`) and run `php -S localhost:8080 -t .` in the `dorm-mart` directory

# POSIX Demo (ssh into Aptitude to user terminal)

Copy any necessary files to the server:

1. `scp -r [local_path] yourubname@aptitude.cse.buffalo.edu:/data/web/CSE442/2025-Fall/cse-442j`
2. Connect to the Aptitude server, Ensure UBWIFI
3. `ssh yourubname@aptitude.cse.buffalo.edu`
4. Enter your UBIT password
5. Navigate to our folder using ` cd /data/web/CSE442/2025-Fall/cse-442j`
6. Run any needed commands in this directory

### Clearing folder for a new build + file permission issues

1. To wipe an existing build to insert your own, run `bash update-perms.sh` or `sh update-perms.sh`
2. Do not delete update-perms.sh
3. If anyone has renamed a folder for deletion, please do so
4. For safety, highlight all files, right-click and go to properties. Set all the permissions as checked and check _Select Permissions Recursively_ to include all files

# Build Method 1: Run React and PHP Server

1. `npm run start-local` \*(add -win or -mac at the end depending on your machine)
2. `php -S localhost:8080 -t .`
   1. (C:\xampp\php\php.exe -S localhost:8080 -t .)
   2. (You Must be inside the dorm-mart folder for this to work)
   3. (It is recommended you also install PHP locally on your machine in addition to XAMMP)
3. refer to "proxy" field in package.json to navigate to the local db

# Build Method 2 : Run Apache Server locally

1. Create /serve/dorm-mart folder in htdocs directory
2. Navigate to your project located in htdocs (if you don't have your project in this directory, copy/paste them)
3. `npm install` to download any new libraries
4. **Set up environment**: Copy `.env.local.example` to `.env.local` and configure FRONTEND_BASE_URL to `http://localhost/serve/dorm-mart`
5. `npm run build-local` to create build folder for local server (add -win or -mac at the end depending on your machine)
6. Upload the build/\*, migrations, api, and .env.local, and any necessary files and folders to /serve/dorm-mart
   1. (\*Copy and paste out all of the contents of the build folder, they cant still be inside the build folder)
   2. (You could make a script to automate this)
   3. (These list of files and folders are subject to change as the project grows)
6. Navigate to localhost/serve/dorm-mart from your browser since that is the file path
7. You now should have the app running on your local apache server
8. Make sure to migrate to apply db schema to your local mysql: `php migrate_schema.php`
9. To add contents to your local db, run `php migrate_data.php`

# Test Server Build: APTITUDE (How to build and upload prod app to aptitude)

1. **Set up environment**: Copy `.env.production.example` to `.env.production` and configure:
   - FRONTEND_BASE_URL: `https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j`
   - Database credentials for Aptitude server
2. `npm run build-prod` (add -win or -mac at the end depending on your machine)
3. Upload 1) build contents\*, 2) migrations, 3) api, 4) .env.production to the aptitude server
   1. (\* Copy and paste out all of the contents of the build folder, they cant still be inside the build folder)
   2. (These list of files and folders are subject to change as the project grows)
3. Make sure to migrate to apply db schema and app data to the mysql server
   (\* It is highly recommended that you build a script to automate this process to avoid missing out some necessary files and mitigate the tedious process)

- Refer to scripts in package.json for more details

# Production Build: CATTLE (How to build and upload prod app to cattle)

1. **Set up environment**: Copy `.env.cattle.example` to `.env.cattle` and configure:
   - FRONTEND_BASE_URL: `https://cattle.cse.buffalo.edu/CSE442/2025-Fall/cse-442j`
   - Database credentials for Cattle server
2. `npm run build-cattle` (add -win or -mac at the end depending on your machine)
3. Upload 1) build contents*, 2) migrations, 3) api, 4) .env.cattle to the cattle server (these list of files and folders are subject to change as the project grows)
   (These list of files and folders are subject to change as the project grows) \
   (* Copy and paste out all of the contents of the build folder, they cant still be inside the build folder) \
   (\* It is highly recommended that you build a script to automate this process to avoid missing out some necessary files and mitigate the tedious process)

- Refer to scripts in package.json for more details

3. Make sure to migrate to apply db schema and app data to the mysql server

# How does the server serve the app?

1. `"homepage": "/CSE442/2025-Fall/cse-442j",`
   The "homepage" field in your package.json tells the React build tools (like react-scripts) what the base URL of your app will be. - It makes sure all asset paths (like CSS, JS, images) inside the build are prefixed with /CSE442/2025-Fall/cse-442j/, so they load correctly when hosted under that subpath instead of at the root. - The key piece is that homepage only affects asset paths, not route handling.

2. Apache just serves whatever’s in that folder — the index.html, JavaScript, CSS, etc.

   - When you go to https://aptitude.cse.buffalo.edu/CSE442/2025-Fall/cse-442j/#/login, Apache returns the same index.html file, because that’s what’s physically there.

3. The React app (client-side router) kicks in after the browser loads the index.html.
   - Since your URL has a hash (#/login), the browser doesn't ask the server for a separate /login resource. Everything after # is handled purely on the client side, meaning all components are loaded entirely within the index.html at once.
   - The React Router reads that hash fragment (#/login) and renders the right component (your Login page). This is how SPA works.

# Environment Configuration

The project uses environment variables for configuration. Key variables:

- **FRONTEND_BASE_URL**: Base URL where the React app is served (required)
- **API_BASE_URL**: Base URL for PHP API (optional, defaults to FRONTEND_BASE_URL + /api)
- **CORS_ALLOWED_ORIGINS**: Comma-separated list of allowed CORS origins (optional, auto-detected)
- **ENVIRONMENT**: Environment name - development, local, production, or cattle (optional, auto-detected)
- **DB_***: Database configuration (required)

See `.env.example` and environment-specific examples (`.env.development.example`, `.env.local.example`, etc.) for details.

**Important**: Only one .env file should exist per environment. The system checks in this order:
1. `.env.development`
2. `.env.local`
3. `.env.production`
4. `.env.cattle`

# Development Utilities

- Clear forgot password rate limit: `php api/utility/manage_forgot_password_rate_limiting.php` (run from dorm-mart folder)
- Clear login lockout timer: `php api/utility/reset_session_lockout.php` (run from dorm-mart folder)

# Windows Powershell Build Scripts Commands

**Build Method 1: Local Development:**
`C:\xampp\htdocs\f25-no-brainers\build-scripts-win\dev.bat`

**Build Method 2: Apache Server:**
`C:\xampp\htdocs\f25-no-brainers\build-scripts-win\apache.bat`

**Production Build APTITUDE:** _(Note: This just creates a folder called prod-build with the needed files so you can paste into the aptitude folder):_
`C:\xampp\htdocs\f25-no-brainers\build-scripts-win\aptitude.bat`

**Production Build CATTLE:** _(Note: This just creates a folder called cattle-build with the needed files so you can paste into the cattle folder):_
`C:\xampp\htdocs\f25-no-brainers\build-scripts-win\cattle.bat`
