# Contributing to Prompt Overflow

Thanks for wanting to help! This project follows a standard **fork + pull request** workflow. Direct pushes to `main` are restricted to maintainers — all contributions land through reviewed PRs.

## Workflow

1. **Fork** the repo and create a branch from `main`:
   ```bash
   git checkout -b feat/my-change
   ```
2. Make your change. Keep PRs small and focused — one feature/fix per PR.
3. **Verify locally** before opening a PR:
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
   If your change touches user flows, run the Playwright suite too (`npm run test:e2e`, needs a seeded Supabase — see README).
4. Open a PR against `main` with a clear description of **what** and **why**. Link any related issue.
5. A maintainer will review. CI (lint + typecheck + build) must pass before merge.

## Guidelines

- **Style:** TypeScript, App Router conventions. Match the existing hand-rolled CSS — no CSS frameworks.
- **Database changes:** add a new timestamped file under `supabase/migrations/` — never edit an existing migration.
- **Security:** never commit secrets. All keys come from env vars (see `.env.example`). Anything touching `SUPABASE_SERVICE_ROLE_KEY` must stay server-side.
- **Commit messages:** conventional-ish (`feat:`, `fix:`, `docs:`, `chore:`) appreciated but not enforced.

## Reporting bugs & ideas

Open a [GitHub issue](../../issues). For security vulnerabilities, please **do not** open a public issue — see [SECURITY.md](SECURITY.md).

## Code of Conduct

Be excellent to each other — see [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
