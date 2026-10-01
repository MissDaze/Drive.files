# Asset Archaeologist

A multi-user web application that connects to Google Drive, analyses user-authorised files with AI, identifies related projects and intellectual property, and surfaces practical commercial opportunities.

The project is designed for Railway: one Docker-built Next.js service plus one PostgreSQL service.

## Drive connection modes

The app supports two Google Drive modes.

### Picker mode — recommended for public deployment

```
GOOGLE_DRIVE_ACCESS_MODE=picker
```

Uses:

```
https://www.googleapis.com/auth/drive.file
```

Users sign in with Google, then explicitly choose files through Google Picker. Only those app-authorised files are imported into Asset Archaeologist. The app itself only performs read/export operations against those files.

This is the recommended launch mode because `drive.file` is Google's narrow per-file scope.

### Full Drive mode — preserves the original product concept

```
GOOGLE_DRIVE_ACCESS_MODE=full
```

Uses:

```
https://www.googleapis.com/auth/drive.readonly
```

This mode inventories the connected user's Drive in resumable pages and can discover forgotten material without the user already knowing which files matter.

However, `drive.readonly` is a Google **restricted scope**. A public application using it must satisfy Google's restricted-scope verification requirements; if restricted-scope data is stored or transmitted server-side, Google also requires a security assessment.

For that reason, full mode is present in the codebase but Picker mode is the safer default for a public Railway deployment.

## What it does

1. User signs in with Google.
2. OAuth credentials are encrypted before being stored in PostgreSQL.
3. In Picker mode, the user chooses the Drive files to analyse.
4. In Full mode, the app inventories the Drive in resumable pages.
5. Supported files are analysed in bounded batches.
6. The AI classifies individual assets such as projects, research, datasets, templates, processes, technical specs, content and sales material.
7. A synthesis pass identifies coherent commercial opportunities.
8. Every opportunity includes:
   - what already exists;
   - readiness / commercial score;
   - target buyer;
   - suggested AUD positioning;
   - best monetisation route;
   - missing pieces;
   - ordered next steps.
9. Users can save an opportunity as a bundle and export the underlying source files plus a manifest as a ZIP.

## User interface

The browser UI includes:

- Google sign-in
- Google Picker file selection in public mode
- full Drive inventory when enabled
- scan / analysis progress
- dashboard counters
- monetisation opportunities
- target buyer and monetisation-route analysis
- asset catalogue with filename search
- persistent saved bundles
- ZIP export

## Supported file analysis

Current extraction supports:

- Google Docs
- Google Sheets
- Google Slides
- PDF
- DOCX
- text files
- JSON / XML / JavaScript
- common image files through the multimodal AI model

Unsupported or oversized files are marked instead of silently disappearing.

## AI model

Default OpenRouter model:

```
qwen/qwen3.7-flash
```

Free fallback:

```
qwen/qwen3.8-27b:free
```

The model is controlled by environment variables.

## Architecture

```
Browser
  |
  v
Next.js 14 / Railway web service
  |
  +-- Google OAuth
  +-- Google Picker (picker mode)
  +-- Google Drive API
  +-- OpenRouter
  |
  v
Railway PostgreSQL
  |
  +-- users
  +-- encrypted Google connections
  +-- sessions
  +-- authorised/indexed Drive files
  +-- scan progress
  +-- per-file analyses
  +-- opportunities
  +-- saved bundles
```

No Redis or worker service is required for the first production version. Analysis runs as short, resumable HTTP steps backed by PostgreSQL.

## Scan state

Full mode:

```
inventorying -> analysing -> synthesizing -> completed
```

Picker mode:

```
user selects files -> analysing -> synthesizing -> completed
```

## Local setup

### Requirements

- Node.js 20.16+
- PostgreSQL
- Google Cloud project
- Google OAuth web client
- Google Drive API
- Google Picker API when using Picker mode
- OpenRouter API key

### Install

```bash
npm install
cp .env.example .env
npx prisma migrate deploy
npm run dev
```

Open:

```
http://localhost:3000
```

## Environment variables

```
APP_URL=http://localhost:3000
APP_ENCRYPTION_KEY=<long-random-secret>
DATABASE_URL=<postgresql-connection-string>

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_ACCESS_MODE=picker

NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
NEXT_PUBLIC_GOOGLE_APP_ID=

OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.7-flash
OPENROUTER_FALLBACK_MODEL=qwen/qwen3.8-27b:free
```

Generate a strong encryption key, for example:

```bash
openssl rand -base64 32
```

Do not change `APP_ENCRYPTION_KEY` after users have connected Drive. Existing OAuth credentials are encrypted with it.

## Google Cloud setup

### Common setup

1. Create or select a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure the Google Auth / OAuth consent screen.
4. Create an **OAuth 2.0 Client ID** of type **Web application**.
5. Add:
   - local origin: `http://localhost:3000`
   - local redirect: `http://localhost:3000/api/auth/callback`
6. For production add the Railway domain:
   - origin: `https://your-app.up.railway.app`
   - redirect: `https://your-app.up.railway.app/api/auth/callback`
7. Put the OAuth client ID and secret into the application environment.

### Picker mode setup

1. Enable **Google Picker API**.
2. Create a Google API key.
3. Restrict it to your application domains and the Picker/Drive APIs.
4. Put it in:

```
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
```

5. Find the numeric Google Cloud project number and put it in:

```
NEXT_PUBLIC_GOOGLE_APP_ID
```

Picker mode requests:

```
openid
email
profile
https://www.googleapis.com/auth/drive.file
```

The browser receives a short-lived access token only when opening Google Picker. Long-lived refresh credentials remain encrypted server-side.

### Full Drive mode setup

Set:

```
GOOGLE_DRIVE_ACCESS_MODE=full
```

Full mode requests:

```
openid
email
profile
https://www.googleapis.com/auth/drive.readonly
```

Do not treat this as a frictionless public OAuth scope. It is restricted and should be enabled for public users only after the relevant Google verification/security work is complete.

## Token lifecycle

- Google access token: encrypted in PostgreSQL.
- Google refresh token: encrypted in PostgreSQL.
- Expired access tokens are refreshed server-side.
- The user's normal application session is an HTTP-only cookie.

## Deploy to Railway

### 1. Create the project

Create a Railway project from this GitHub repository and select:

```
rewrite/asset-archaeologist
```

while testing.

### 2. Add PostgreSQL

Add a Railway PostgreSQL service and expose its `DATABASE_URL` to the web service.

### 3. Add variables

For Picker mode:

```
DATABASE_URL
APP_ENCRYPTION_KEY
APP_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_DRIVE_ACCESS_MODE=picker
NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
NEXT_PUBLIC_GOOGLE_APP_ID
OPENROUTER_API_KEY
OPENROUTER_MODEL=qwen/qwen3.7-flash
OPENROUTER_FALLBACK_MODEL=qwen/qwen3.8-27b:free
```

### 4. Generate the Railway domain

Set:

```
APP_URL=https://your-app.up.railway.app
```

Then add that origin and callback URI to the Google OAuth client.

### 5. Deploy

Railway detects the committed `Dockerfile`. The container:

- installs npm dependencies;
- generates the Prisma client;
- builds Next.js;
- runs `prisma migrate deploy`;
- starts the web service.

Set the Railway health-check path to:

```
/api/health
```

The initial migration is committed under `prisma/migrations/`.

## Multi-user data separation

Every user-owned record is keyed to the authenticated user's database ID:

- Drive metadata
- scans
- analyses
- opportunities
- bundles

Bundle export re-validates ownership before retrieving Drive content.

## Privacy notes

- Picker mode gives the application access to files the user explicitly authorises through the app.
- Full mode uses broad read-only Drive access.
- The application code does not issue file write/delete requests.
- OAuth credentials are encrypted at rest with AES-256-GCM.
- File content selected for analysis is sent to the configured OpenRouter model/provider.
- Only bounded content previews are stored in PostgreSQL.
- Source files remain in Google Drive.
- ZIP exports are generated on demand.

Before a public launch, add a privacy policy, user data deletion, retention controls, usage quotas and billing.

## Known limitations

- Picker mode cannot automatically discover files that the user has not authorised.
- Full Drive discovery requires Google's restricted-scope compliance path.
- Large PDFs/DOCX/images are intentionally skipped to control memory and cost.
- Opportunity synthesis works in batches and may need stronger cross-batch deduplication for very large archives.
- Each fresh scan currently re-analyses the selected/indexed files rather than reusing unchanged prior analyses.

## Development branch

The original version remains on `main`.

The rewrite is on:

```
rewrite/asset-archaeologist
```
