# Progress Summary

Last updated: 2026-06-30

## Current Status

Phase 1 foundation, Phase 1.5 architecture safeguards, Phase 2A Task Core, and Phase 2B Leave Requests Core are implemented. The project now has two production-style business workflows using the shared SaaS infrastructure.

Current Git state:

- Branch: `feature/leave-requests`
- Base branch `main` includes merged Phase 2A through `56ef8d5 Update Phase 2A progress summary`.
- Pending branch goal: Phase 2B Leave Requests Core.

The repository now contains:

- `apps/web`: Next.js 15 App Router frontend with Arabic RTL and English LTR support.
- `apps/api`: NestJS API with Prisma, PostgreSQL, JWT auth, Swagger, and guards.
- `packages/ui`: Shared UI primitives and theme styling.
- `packages/types`: Shared TypeScript contracts.
- `packages/config`: Roles, permissions, locales, and tenant constants.
- `packages/shared`: Shared API response utilities.

## Implemented Foundation

- Docker PostgreSQL and Redis setup.
- Prisma schema, migration, seed data, and UUID-based models.
- Multi-tenant data model with `company_id` on business entities.
- Authentication flow with access and refresh tokens.
- Companies, users, roles, permissions, departments, audit logs, and activities.
- Tenant, role, and permission guards.
- Swagger documentation at `/docs`.
- Refactored frontend routes and shell architecture.
- Theme provider with dark and light mode.
- `next-intl` locale structure for Arabic and English.
- Protected app shell with sidebar, topbar, global search, company switcher, and notifications.
- Generic attachments and comments modules.
- Persistent notifications module with read/unread actions.
- Per-company SMTP settings with encrypted password storage.
- BullMQ email queue infrastructure.
- Search index, approval workflow, tags, and user preference tables.
- Tenant isolation integration test for users, tasks, and emails.
- Storage provider abstraction for attachment file metadata.
- Domain event bus foundation for activity, notification, audit, and search publishing.
- Email provider and search indexer abstractions.
- Versioned API routes under `/api/v1`.

## Implemented Phase 2A Task Core

- Added task database migration for:
  - `task_number`
  - `completed_at`
  - `reminder_sent_at`
  - `estimated_hours`
  - `actual_hours`
  - `task_watchers`
- Added `TASK_DUE_SOON` notification enum support.
- Added NestJS `TasksModule`, `TasksController`, and `TasksService`.
- Added task endpoints under `/api/v1/tasks`:
  - list and detail
  - create and update
  - assign assignees
  - update watchers
  - change status
  - soft delete
  - task comments
  - task attachments
- Added task-specific permission checks:
  - `tasks:read`
  - `tasks:create`
  - `tasks:update`
  - `tasks:delete`
  - `tasks:assign`
  - `tasks:comment`
  - `tasks:attach`
  - `tasks:complete`
- Added `TaskEventsHandler` subscriber for DomainEventBus task events.
- Task events now create activity feed entries, audit logs, notifications, and search index updates through subscribers instead of direct service calls.
- Integrated generic comments and attachments with tasks through `entity_type = TASK`.
- Added seeded tenant tasks for the Advanced Tech company.
- Added frontend task API service, task list filters, task detail panel, comments, attachments, status changes, create/edit modal, and Kanban data loading.
- Fixed auth-store session hydration by moving `localStorage` reads into a client effect.

## Implemented Phase 2A Hardening

- Added task status transition rules:
  - `NEW -> ASSIGNED`
  - `ASSIGNED -> IN_PROGRESS`
  - `IN_PROGRESS -> PENDING | COMPLETED`
  - `PENDING -> IN_PROGRESS | COMPLETED`
  - terminal states cannot be moved back without a future reopen action.
- Added `GET /api/v1/tasks/:id/history`.
- Enriched task search indexing with assignee names, assignee emails, and department data.
- Added BullMQ task reminder queue scaffold for due-soon and overdue scans.
- Added `TASK_OVERDUE` notification enum support.

## Implemented Phase 2B Leave Requests Core

- Added `leave_types` table and seeded company leave types:
  - Annual
  - Sick
  - Emergency
  - Unpaid
- Extended leave requests with:
  - `leave_type_id`
  - `submitted_at`
  - `approved_at`
  - `rejected_at`
  - `cancelled_at`
- Added reusable `ApprovalWorkflowsService`.
- Added default leave approval path:
  - Manager approval
  - Company Admin approval
- Added NestJS Leave Requests module with endpoints for:
  - leave types
  - list/detail/history
  - submit
  - update pending requests
  - approve
  - reject
  - cancel
  - comments
  - attachments
- Added leave-specific permissions:
  - `leave_requests:read`
  - `leave_requests:submit`
  - `leave_requests:update`
  - `leave_requests:cancel`
  - `leave_requests:approve`
  - `leave_requests:reject`
  - `leave_types:read`
  - `leave_types:write`
- Added leave event subscriber for activities, audit logs, notifications, and search indexing.
- Added notification support for:
  - `LEAVE_SUBMITTED`
  - `LEAVE_APPROVED`
  - `LEAVE_REJECTED`
  - `LEAVE_CANCELLED`
- Replaced static Leave Requests UI with API-backed filters, request modal, approval/rejection actions, and detail timeline.
- Added `test:leave-requests-core` regression coverage.

## Recent Fixes

- Added locale root redirects:
  - `/ar` redirects to `/ar/login`.
  - `/en` redirects to `/en/login`.
- Fixed localhost startup and stale `.next` cache issue.
- Fixed theme hydration mismatch by delaying theme icon rendering until the client has mounted.
- Added body hydration suppression for browser-extension-injected attributes.
- Replaced the notification side drawer with a responsive dropdown menu:
  - Desktop: anchored under the notification bell.
  - Mobile: viewport-safe full-width dropdown below the header.
  - Supports outside click and Escape key closing.
- Added Phase 1.5 database migration and API modules for reusable pre-Phase-2 infrastructure.
- Added pre-Phase-2 hardening for tenant isolation, permission matrix, queues, storage, events, email provider, search indexer, and API v1 routing.
- Implemented Phase 2A Task Core backend and frontend.
- Implemented Phase 2B Leave Requests Core backend and frontend.

## Local Testing

Current development URLs:

- Web Arabic login: `http://localhost:3000/ar/login`
- Web English login: `http://localhost:3000/en/login`
- Arabic dashboard: `http://localhost:3000/ar/dashboard`
- Arabic task list: `http://localhost:3000/ar/tasks/list`
- Arabic Kanban: `http://localhost:3000/ar/tasks/kanban`
- Arabic leave requests: `http://localhost:3000/ar/leaves`
- English leave requests: `http://localhost:3000/en/leaves`
- API docs: `http://localhost:4000/docs`
- API base: `http://localhost:4000/api/v1`

Seed login:

```text
admin@company.com
Password123!
```

Validation run successfully:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test:tenant-isolation
corepack pnpm test:tasks-core
corepack pnpm test:leave-requests-core
```

Additional local smoke checks completed:

- Authenticated seed admin login against `http://localhost:4000/api/v1/auth/login`.
- Authenticated `GET /api/v1/tasks`, returning 3 seeded tenant tasks.
- Authenticated `GET /api/v1/leave-types`, returning 4 seeded leave types.
- Authenticated `GET /api/v1/leave-requests`, returning 1 seeded pending leave request.
- Web route checks returned HTTP 200:
  - `/ar/tasks/list`
  - `/ar/tasks/kanban`
  - `/en/tasks/list`
  - `/en/tasks/kanban`
  - `/ar/leaves`
  - `/en/leaves`

## Remaining Work

The following modules should be implemented after Phase 2B approval:

- Task refinements:
  - richer multi-assignee editing
  - drag-and-drop Kanban status changes
  - reminder queue processors for due-soon and overdue notifications
  - uploaded binary file handling beyond attachment metadata
- Leave request refinements:
  - configurable workflow editor UI
  - leave balance tracking
  - calendar availability view
- Email center backend implementation.
- SMTP email worker and delivery status processing.
- Real company switcher behavior for Super Admin users.
- Real global search.

## Git Progress

Recent completed commits:

- `8addabf Implement Phase 1 SaaS foundation`
- `95bc0d5 Add locale index redirects`
- `24ff51a Fix theme hydration mismatch`
- `a7db484 Suppress extension body hydration noise`
- `7727e57 Replace notifications drawer with dropdown`
- `3fe4d84 Add Phase 1.5 reusable infrastructure`
- `8db5bbc Add pre-Phase-2 architecture safeguards`
- `f351a40 Implement Phase 2A task core`
- Phase 2B Leave Requests Core pending commit on `feature/leave-requests`
