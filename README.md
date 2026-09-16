# Lumia AI Builder

Lumia AI Builder — NVIDIA NIM powered software-building foundation.

## Current stage: v7 GitHub Sync

The `main` branch now includes:
- NVIDIA NIM planning/code/debug pipeline
- bounded autonomous build + debug retries
- isolated Docker validation
- PostgreSQL/Prisma project storage
- email/password authentication with server-side sessions
- authenticated project create/list/read/update/delete APIs
- generated-file persistence per project
- Builder file explorer + code editor + Save + AI Fix
- authenticated AI debug endpoint
- GitHub repository sync using the Git Git Data API (blobs → tree → commit → branch ref)

## Environment

Create `.env.local` from `.env.example` and set:

```env
DATABASE_URL=postgresql://...
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=qwen/qwen2.5-coder-32b-instruct
```

Never commit `NVIDIA_API_KEY`, `.env`, GitHub tokens, credentials, or other secrets.

## GitHub Sync

In the Builder, select a project, enter a destination repository as `owner/repository`, choose the branch, and provide a GitHub token with permission to write to that repository. Lumia uses the token only for the sync request and does not persist it. The current implementation pushes the selected project's files as one commit to an existing branch; it does not yet implement OAuth login, repository creation, pull, conflict resolution, or branch creation.

For production, prefer GitHub App/OAuth based authorization rather than asking users to paste long-lived personal access tokens into the UI. Add rate limits, audit logging, repository allowlists, and secret scanning before public release.

## Database setup

After pulling the repository:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name auth_and_project_ownership
npm run dev
```

For a production deployment, run the equivalent migration with your deployment process (for example `prisma migrate deploy`) rather than `prisma migrate dev`.

## Important security note

The sandbox performs dependency installation in a temporary isolated Docker workspace and then runs the build with networking disabled. Generated package dependencies are still untrusted supply-chain input; production hardening should add dependency allowlists/caching, resource quotas, and stronger container isolation before exposing the builder publicly.
