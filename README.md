# Drive Files AI Bundler

A tool that connects to a user's Google Drive, lists their files, and uses AI to analyze file content and automatically group related files into product bundles.

## Features

- Google Drive OAuth connection and file listing
- AI-powered analysis of selected files
- Automatic product bundling suggestions based on file content

## Tech Stack

- **Framework**: Next.js (App Router), TypeScript
- **UI**: Tailwind CSS, Radix UI
- **AI**: Groq (via the AI SDK)
- **Auth/Storage**: Google Drive API (OAuth)

## Setup

1. Install dependencies:
   ```
   pnpm install
   ```
2. Configure Google OAuth credentials and your Groq API key as environment variables.
3. Run in development:
   ```
   pnpm dev
   ```
4. Build for production:
   ```
   pnpm build
   pnpm start
   ```
