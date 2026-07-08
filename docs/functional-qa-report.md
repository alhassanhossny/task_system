# Functional QA Report

Last updated: 2026-07-08

## Scope

Phase 4.5 System Stabilization, Functional QA, and Regression Review.

This pass reviewed existing functionality only. No new business modules, database schema changes, or public API contract changes were introduced.

## Modules Reviewed

- Authentication and session persistence.
- Locale routing, Arabic RTL, and English LTR shell behavior.
- Dashboard route availability.
- Tasks workflow, assignment, status transitions, events, notifications, history, and search side effects.
- Leave requests, leave enhancements, balances, calendar, availability, and permissions through existing regression suites.
- Team management through existing regression suites.
- Email Center through existing regression suites.
- Notifications API and dropdown integration.
- Global search and saved filters through existing regression suites.
- Super Admin Platform APIs and dashboard route availability.
- Background usage snapshot queue through existing regression suites.
- Docker web/API runtime health.

## Bugs Fixed

### Task Creation Started As Assigned

Root cause:

- `TasksService.create()` used submitted `assigneeIds` to create the task as `ASSIGNED`.
- The frontend create modal exposed an assignee field, allowing users to skip the intended explicit assignment step.
- The task regression still expected the old behavior.

Fix:

- `TasksService.create()` now always creates tasks as `NEW`.
- Task assignment remains an explicit call to `PATCH /api/v1/tasks/:id/assignees`.
- The create modal no longer shows assignee selection for new tasks.
- Edit flows still call the explicit assignment endpoint.
- Task regression coverage now asserts create `NEW`, no initial assignees, assignment transition to `ASSIGNED`, and assignment notification creation.

### Mark All Notifications Read Did Nothing

Root cause:

- The notification dropdown rendered static sample notifications and did not call the existing notification APIs.

Fix:

- Added a frontend notification API service.
- The topbar unread badge and dropdown now use persisted notifications through React Query.
- `Mark all read` calls `PATCH /api/v1/notifications/read-all`.
- Single notification click calls `PATCH /api/v1/notifications/:id/read`.
- Query invalidation refreshes the dropdown and unread badge.
- Added notification regression coverage for list, mark-all-read, single read, and per-user isolation.

### Locale Switching Logged Out Authenticated Users

Root cause:

- The protected app shell redirected to login before persisted auth state finished hydrating from `localStorage` after a locale-route remount.

Fix:

- Auth context now exposes `isHydrated`.
- The app shell waits for hydration before redirecting unauthenticated users.
- Locale switching continues to only change the locale path and does not clear session storage.
- Added session persistence regression coverage for hydration and locale switching.

## Files Modified

- `.github/workflows/release.yml`
- `.github/workflows/tests.yml`
- `apps/api/package.json`
- `apps/api/src/notifications/tests/notifications.test.ts`
- `apps/api/src/tasks/tasks.service.ts`
- `apps/api/src/tasks/tests/tasks-core.test.ts`
- `apps/web/src/features/app-shell/app-shell.tsx`
- `apps/web/src/features/app-shell/app-topbar.tsx`
- `apps/web/src/features/app-shell/notification-dropdown.tsx`
- `apps/web/src/features/auth/auth-store.tsx`
- `apps/web/src/features/auth/tests/session-persistence.test.ts`
- `apps/web/src/features/notifications/notifications-service.ts`
- `apps/web/src/features/tasks/kanban-view.tsx`
- `apps/web/src/features/tasks/task-widgets.tsx`
- `apps/web/src/features/tasks/tasks-list-view.tsx`
- `docs/progress-summary.md`
- `package.json`

## Tests Added Or Updated

- Added `test:notifications`.
- Added `test:session-persistence`.
- Updated `test:tasks-core` for the corrected task workflow.
- Added the new stabilization tests to regression and release GitHub Actions workflows.

## Validation Results

Passed:

- `corepack pnpm db:generate`
- `corepack pnpm typecheck`
- `corepack pnpm lint`
- `corepack pnpm build`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:tenant-isolation`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:tasks-core`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:notifications`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:leave-requests-core`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:leave-enhancements`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:leave-balances`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:calendar`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:permissions`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:team-management`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:global-search`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:email-center`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:platform-company-management`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:platform-subscriptions`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:platform-company-switching`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:platform-analytics`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:platform-usage-snapshots`
- `DATABASE_URL='postgresql://taskflow:taskflow@127.0.0.1:5544/taskflow?schema=public' corepack pnpm test:platform-security`
- `corepack pnpm test:platform-dashboard`
- `corepack pnpm test:session-persistence`

Notes:

- `tsx` tests were run outside the restricted sandbox due to the known `/tmp/tsx-*` IPC pipe restriction.
- Docker images for API and web were rebuilt successfully.
- API and web containers were recreated in the existing `taskflow_phase5` Compose project.

## Smoke Checks

Passed:

- API health: `GET http://127.0.0.1:4000/api/v1/health`
- Web routes:
  - `/ar/login`
  - `/en/login`
  - `/ar/dashboard`
  - `/ar/tasks/list`
  - `/ar/tasks/kanban`
  - `/ar/leaves`
  - `/ar/team`
  - `/ar/email`
  - `/ar/platform`
  - `/ar/platform/companies`
  - `/ar/platform/subscriptions`
  - `/ar/platform/plans`
  - `/ar/platform/analytics`
  - `/ar/platform/settings`
  - `/ar/platform/switch-sessions`
- Login smoke from `http://127.0.0.1:3000` returned success.
- Notification `read-all` API returned success.
- Authenticated task creation returned status `NEW`; the temporary smoke task was deleted.

## Known Limitations

- Binary file upload and download remain metadata-only through the existing attachment abstraction.
- Task assignment in the current UI is still single-assignee in the edit modal, while the backend supports multiple assignees.
- Some workflow validation remains regression-test based rather than browser-automated end-to-end testing.
- Existing platform users/employees management remains future work listed in the progress summary.
