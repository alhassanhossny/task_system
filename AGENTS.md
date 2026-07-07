# AGENTS.md

## Project Context

TASK Flow SaaS is a multi-tenant monorepo with:

- `apps/web`: Next.js 15 App Router frontend.
- `apps/api`: NestJS API with Prisma, PostgreSQL, JWT, Swagger, BullMQ, and Redis.
- `packages/ui`: Shared UI primitives and theme styling.
- `packages/types`: Shared TypeScript contracts.
- `packages/config`: Roles, permissions, locales, and tenant constants.
- `packages/shared`: Shared API response utilities.

As of 2026-07-07, the active development branch is expected to be:

```bash
feature-phase5-production-readiness
```

Current milestone:

- Phase 5 Step 1 GitHub Actions CI/CD Pipeline is complete.
- Phase 4 Step 8 Super Admin Web Dashboard is complete.
- Platform Analytics Improvements Step 1 completed the usage snapshot worker and scheduler pipeline.
- Platform Analytics Improvements Step 2 optimized analytics and usage snapshot queries.
- Platform Analytics Improvements Step 3 added endpoint-level Platform Administration authorization tests.
- The current release baseline is `v1.0.0-beta`.
- Next planned implementation milestone is Phase 5 Step 2 Production Health Checks and Observability, pending review.

Check `docs/progress-summary.md` before starting any work. It is the source of truth for completed phases, validation status, local URLs, and follow-up work.

## Non-Negotiable Architecture Rules

- Preserve the existing monorepo structure.
- Do not redesign the frontend unless explicitly requested.
- Do not introduce alternative frameworks.
- Keep every tenant business entity scoped by `company_id`.
- Maintain strict tenant isolation in services, guards, and tests.
- Use permission checks, not hardcoded role conditionals.
- Keep platform/Super Admin permissions separate from tenant/company permissions.
- Publish domain events and let subscribers handle side effects where the pattern already exists.
- Do not call notification, activity, audit, or search services directly from feature services if an event/subscriber pattern exists.
- Keep Arabic RTL and English LTR support working.
- Do not commit secrets, tokens, `.env`, generated build output, or local database dumps.

## Repository Setup On A New Machine

Prerequisites:

- Node.js compatible with the repo toolchain.
- Corepack enabled.
- Docker and Docker Compose.
- Git credentials configured outside the repository.

Setup:

```bash
corepack enable
corepack pnpm install
cp .env.example .env
docker compose up -d postgres redis
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
```

Default local URLs:

- Web: `http://localhost:3000/ar/login`
- API: `http://localhost:4000/api/v1`
- Swagger: `http://localhost:4000/docs`

Seed login:

```text
admin@company.com
Password123!
```

The default `.env.example` uses PostgreSQL on port `5432`. This workspace has also used this test URL when PostgreSQL is mapped to `5433`:

```bash
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public'
```

Use the URL that matches the local machine.

## Development Workflow

Before coding:

```bash
git status --short --branch
corepack pnpm db:generate
corepack pnpm typecheck
corepack pnpm lint
```

When implementing a feature:

- Inspect existing modules first.
- Follow local DTO, service, controller, guard, event, queue, and test patterns.
- Keep each milestone small and reviewable.
- Update `docs/progress-summary.md` after each completed checkpoint.
- Add or update tests with every behavior change.
- Run validation before committing.

Manual edits should use patches, not shell redirection.

## Validation Commands

Run at minimum:

```bash
corepack pnpm db:generate
corepack pnpm typecheck
corepack pnpm lint
```

For platform work, run:

```bash
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:tenant-isolation
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:platform-company-management
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:platform-subscriptions
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:platform-company-switching
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:platform-analytics
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:platform-usage-snapshots
DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5433/taskflow?schema=public' corepack pnpm test:platform-security
corepack pnpm test:platform-dashboard
```

If the local database uses port `5432`, replace the URL accordingly.

Known local issue:

- Some `tsx` tests may fail inside restricted sandboxes with an IPC pipe error under `/tmp/tsx-*`.
- If that happens, rerun the same command outside the sandbox. Do not change the test because of this environment-only error.

Before committing:

```bash
git diff --check
rg -n --hidden -g '!.git' -g '!node_modules' -g '!.next' "g[h]p_|github_[p]at|GITHUB_[T]OKEN" .
git status --short
```

The secret scan should return no matches.

## Phase 4 Status

Completed Phase 4 milestones:

- Step 1: SaaS database schema.
- Step 2: Super Admin permissions.
- Step 3: Platform backend skeleton.
- Step 4: Company management APIs.
- Step 5: Subscription management APIs.
- Step 6: Company switching service.
- Step 7: Platform analytics and usage metrics.
- Step 8: Super Admin web dashboard.

Step 7 added:

- `GET /api/v1/platform/analytics/overview`
- `GET /api/v1/platform/analytics/usage`
- `GET /api/v1/platform/analytics/top-companies`
- `GET /api/v1/platform/analytics/subscription-distribution`
- `PlatformUsageSnapshotsService`
- `platform-usage-snapshot` BullMQ queue scaffold
- `PLATFORM_USAGE_SNAPSHOT_CREATED`
- `test:platform-analytics`

Platform Analytics Improvements Step 1 added:

- `PlatformUsageSnapshotWorker`
- bootstrap scheduling through `PlatformUsageSnapshotQueue.onApplicationBootstrap()`
- stable BullMQ scheduler id `platform-usage-snapshot:daily`
- retry/backoff handling for scheduled and manual snapshot jobs
- `test:platform-usage-snapshots`

Platform Analytics Improvements Step 2 added:

- grouped aggregate analytics queries for overview counts, usage metrics, top companies, and snapshot generation
- batched company metric collection in `PlatformUsageSnapshotsService`
- regression coverage for multi-company snapshot accuracy and larger snapshot datasets

Platform Analytics Improvements Step 3 added:

- endpoint-level HTTP authorization regression coverage for Platform Administration routes
- explicit coverage for anonymous, invalid JWT, expired JWT, tenant role denial, Super Admin access, switch token revocation, and suspended tenant blocking
- permission decorator checks for `platform:read`, `platform:manage`, `analytics:read`, `subscriptions:manage`, `companies:suspend`, and `tenant_switch:execute`
- `test:platform-security`

Phase 4 Step 8 added:

- Platform Administration frontend routes under `/platform`
- permission-gated Platform sidebar section
- Super Admin dashboard, companies, subscriptions, plans, analytics, settings, and switch session views
- frontend Platform API service and permission helpers
- Arabic and English Platform navigation labels
- `test:platform-dashboard`

Next recommended scope:

- Phase 5 Step 2 Production Health Checks and Observability after CI is verified on GitHub.

## Phase 5 Status

Completed Phase 5 milestones:

- Step 1: GitHub Actions CI/CD Pipeline.

Step 1 added:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/workflows/dependency-review.yml`
- `.github/workflows/codeql.yml`
- PostgreSQL and Redis CI service containers
- pnpm and Prisma cache configuration
- test log, optional coverage, and build-output artifacts
- CI/release validation for Prisma generate, migrations, seed, typecheck, lint, regression tests, and production build

## Release Baseline Rules

Before starting Phase 5:

- Merge `feature-super-admin-portal` into `main`.
- Tag the stable baseline as `v1.0.0-beta`.
- Keep `CHANGELOG.md` updated for release notes.
- Treat all existing Prisma migrations as frozen after the beta tag.
- Do not edit existing migrations after tagging; add new migrations only for approved Phase 5 work or critical fixes.
- Run the full regression suite before release tagging or pushing.

## Git And Remote Notes

Remote:

```bash
origin https://github.com/alhassanhossny/task_system.git
```

Use normal Git credential management or GitHub CLI authentication on the machine. Never place credentials in files, commit messages, remotes, shell history snippets, documentation, or test fixtures.

After a validated milestone:

```bash
git add <changed-files>
git commit -m "<clear milestone message>"
git push origin feature-super-admin-portal
```
