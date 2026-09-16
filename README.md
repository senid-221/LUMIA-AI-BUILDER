# Lumia AI Builder

Lumia AI Builder — NVIDIA NIM powered software-building foundation.

## Current stage: v5 foundation

The `main` branch now includes:
- NVIDIA NIM planning/code/debug pipeline
- bounded autonomous build + debug retries
- isolated Docker validation
- PostgreSQL/Prisma project storage
- email/password authentication with server-side sessions
- authenticated project create/list/read/update/delete APIs
- generated-file persistence per project
- Builder UI with sign in/sign up and saved-project selection

## Environment

Create `.env.local` from `.env.example` and set:

```env
DATABASE_URL=postgresql://...
NVIDIA_API_KEY=...
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=qwen/qwen2.5-coder-32b-instruct
```

Never commit `NVIDIA_API_KEY`, `.env`, credentials, or other secrets.

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
