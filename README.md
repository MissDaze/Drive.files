# Asset Archaeologist

A multi-user web application that connects to Google Drive, inventories a user's files, analyses readable content with AI, identifies related projects and intellectual property, and surfaces practical commercial opportunities.

The project is designed for Railway: one Next.js service plus one PostgreSQL service.

## What it does

1. User signs in with Google and grants **read-only Google Drive access**.
2. The app stores the user's Google OAuth tokens **encrypted** in PostgreSQL.
3. A scan inventories the Drive in resumable pages instead of stopping at the first 100 files.
4. Supported files are analysed in small batches.
5. The AI classifies individual assets such as projects, research, datasets, templates, processes, technical specs, content and sales material.
6. A synthesis pass identifies coherent commercial opportunities.
7. Every opportunity includes:
   - what already exists;
   - readiness / commercial score;
   - target buyer;
   - suggested AUD positioning;
   - best monetisation route;
   - missing pieces;
   - ordered next steps.
8. Users can save an opportunity as a bundle and export the underlying source files plus a manifest as a ZIP.

## User interface

The browser UI includes:

- Google Drive connection / sign-in
- scan progress
- dashboard counters
- monetisation opportunities
- target buyer and monetisation-route analysis
- asset catalogue with filename search
- persistent saved bundles
- real ZIP export

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

Folders are inventoried but are not themselves analysed as content. Unsupported or oversized files are marked instead of silently disappearing.

## AI model

The default OpenRouter model is:

```
qwen/qwen3.7-flash
```

It was selected for low operating cost, long context and multimodal support. A free fallback can be configured:

```
qwen/qwen3.8-27b:free
```

The model is configurable entirely through environment variables.

## Architecture

```
Browser
  |
  v
Next.js 14 / Railway web service
  |
  +-- Google OAuth + Drive API (read only)
  |
  +-- OpenRouter
  |
  v
Railway PostgreSQL
  |
  +-- users
  +-- encrypted Google connections
  +-- sessions
  +-- indexed Drive files
  +-- scan progress
  +-- per-file analyses
  +-- opportunities
  +-- saved bundles
```

No Redis or background-worker service is required for the first production version. Scans are implemented as short, resumable HTTP steps backed by PostgreSQL, avoiding one long request that can time out.

## Scan state machine

```
inventorying
   |
   v
analysing
   |
   v
synthesizing
   |
   v
completed
```

The browser advances the scan one bounded step at a time. Scan state lives in PostgreSQL, so different customers cannot share scan state and a page refresh does not erase progress.

## Local setup

### Requirements

- Node.js 20.16+
- PostgreSQL
- Google OAuth credentials
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

OPENROUTER_API_KEY=
OPENROUTER_MODEL=qwen/qwen3.7-flash
OPENROUTER_FALLBACK_MODEL=qwen/qwen3.8-27b:free
```

Generate a strong encryption key, for example:

```bash
openssl rand -base64 32
```

**Do not change APP_ENCRYPTION_KEY after users have connected Drive.** Existing stored OAuth tokens are encrypted with it.

## Google Drive connection

This is a standard server-side Google OAuth flow.

### Google Cloud setup

1. Create or select a Google Cloud project.
2. Enable **Google Drive API**.
3. Configure the OAuth consent screen.
4. Create an **OAuth 2.0 Client ID** of type **Web application**.
5. For local development add:
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/api/auth/callback`
6. For production add your Railway public URL, for example:
   - Origin: `https://your-app.up.railway.app`
   - Redirect URI: `https://your-app.up.railway.app/api/auth/callback`
7. Put the client ID and secret in the application environment.

The application asks for:

```
openid
email
profile
https://www.googleapis.com/auth/drive.readonly
```

It cannot modify or delete Drive files.

### Token lifecycle

- Google access token: encrypted in PostgreSQL.
- Google refresh token: encrypted in PostgreSQL.
- Expired access tokens are refreshed server-side automatically.
- The browser receives only the application's own HTTP-only session cookie.

## Deploy to Railway

### 1. Create the project

Create a Railway project from this GitHub repository and select the rewrite branch while testing:

```
rewrite/asset-archaeologist
```

### 2. Add PostgreSQL

Add a Railway PostgreSQL service and expose its `DATABASE_URL` to the web service.

### 3. Add variables

Set:

```
DATABASE_URL
APP_ENCRYPTION_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
OPENROUTER_API_KEY
OPENROUTER_MODEL=qwen/qwen3.7-flash
OPENROUTER_FALLBACK_MODEL=qwen/qwen3.8-27b:free
```

### 4. Generate a public domain

Generate the Railway service domain, then set:

```
APP_URL=https://your-app.up.railway.app
```

Add the same domain and `/api/auth/callback` URI in the Google Cloud OAuth client.

### 5. Deploy

`railway.json` configures:

- npm install
- Prisma client generation
- Next.js production build
- `prisma migrate deploy` before startup
- `/api/health` health check
- automatic restart on failure

The initial database migration is committed under `prisma/migrations/`.

## Multi-user data separation

Every customer-owned record is keyed to the authenticated user's database ID. This applies to:

- Drive metadata
- scans
- analyses
- opportunities
- bundles

Bundle export also re-validates that every requested file belongs to the signed-in user before retrieving it from Drive.

## Privacy notes

This application reads private Drive content, so disclosure matters.

- Google Drive permission is read-only.
- OAuth credentials are encrypted at rest using AES-256-GCM.
- File content selected for AI analysis is sent to the configured OpenRouter model/provider.
- Only a bounded content preview is stored in the application's database.
- Source files remain in Google Drive.
- ZIP exports are generated on demand and are not persisted by the application.

Before selling this as a public SaaS, add a formal privacy policy, retention/deletion controls and Google OAuth verification if required for your intended user volume/scopes.

## Known limitations

- Google Drive metadata is indexed broadly, but unsupported binary formats are not semantically analysed.
- Large PDFs/DOCX/images are intentionally skipped to control memory/cost.
- Opportunity synthesis currently works in batches; very large Drives may produce overlapping candidate opportunities that can later be deduplicated more aggressively.
- The app currently analyses each fresh scan independently rather than reusing an unchanged file's prior AI analysis.
- A production public launch should add account deletion, data-retention controls, usage quotas and billing.

## Development branch

The original implementation is preserved on `main`.

The multi-user rewrite lives on:

```
rewrite/asset-archaeologist
```
