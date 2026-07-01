# Progress Summary

Last updated: 2026-07-01

## Current Status

Phase 1 foundation, Phase 1.5 architecture safeguards, Phase 2A Task Core, Phase 2B Leave Requests Core, Phase 2B.1 Leave Enhancements, Phase 2B.2 Manager Hierarchy & Team Management, Phase 2C Global Search & Productivity Layer, and Phase 3 Email Center are implemented.

Current Git state:

- Branch: `feature/email-center`
- Base branch `main` includes merged Phase 2B through `f902ce7 Update Phase 2B progress summary`.
- Latest implementation commit: `Implement Phase 2B.1 leave enhancements`.
- Latest login fix commit: `925603c Fix local login CORS origins`.
- Latest alignment commit: `Align time-off enhancements with Phase 2B.1 scope`.
- Latest Phase 2B.2 work: `Implement Phase 2B.2 manager hierarchy and team management`.
- Latest Phase 2C work: `Implement Phase 2C global search and productivity layer`.
- Latest Phase 3 work: `Implement Phase 3 email center`.
- Pull request URL: `https://github.com/alhassanhossny/task_system/pull/new/feature/email-center`

The repository now contains:

- `apps/web`: Next.js 15 App Router frontend with Arabic RTL and English LTR support.
- `apps/api`: NestJS API with Prisma, PostgreSQL, JWT auth, Swagger, and guards.
- `packages/ui`: Shared UI primitives and theme styling.
- `packages/types`: Shared TypeScript contracts.
- `packages/config`: Roles, permissions, locales, and tenant constants.
- `packages/shared`: Shared API response utilities.

## Progress Update Rule

After each completed development step, update this file before moving to the next step.

Each update should include:

- What changed.
- Files, migrations, endpoints, or scripts added.
- Validation run and whether it passed.
- Any known follow-up or blocker.

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

## Implemented Phase 2B.1 Leave Enhancements

- Promoted Time Off Requests into a fuller HR module without replacing the existing leave architecture.
- Added leave duration support:
  - full-day leave
  - half-day leave with morning/afternoon period
  - explicit half-day AM and half-day PM API duration values
  - hourly permission requests
- Added request metadata:
  - `request_number`
  - `request_type = LEAVE | PERMISSION`
  - `start_time`
  - `end_time`
- Added `INFO_REQUESTED` leave status and manager/HR action:
  - `POST /api/v1/leave-requests/:id/request-info`
  - employee updates move the request back to pending review.
- Added company leave settings:
  - `leave_settings`
  - `MANAGER_ONLY`
  - `MANAGER_HR`
- Updated `ApprovalWorkflowsService` so the default leave workflow is reconciled from company settings.
- Added leave balance tracking:
  - `leave_balances`
  - allocated days
  - used days
  - remaining days
  - year
- Added leave balance API:
  - `GET /api/v1/leave-balances/me`
  - `GET /api/v1/leave-balances`
  - `POST /api/v1/leave-balances`
  - `PATCH /api/v1/leave-balances/:id`
- Added leave settings API:
  - `GET /api/v1/leave-settings`
  - `PATCH /api/v1/leave-settings`
- Added leave calendar and availability APIs:
  - `GET /api/v1/leave-requests/calendar`
  - `GET /api/v1/leave-requests/availability`
  - `GET /api/v1/calendar/team`
  - `GET /api/v1/calendar/department/:id`
- Approval completion now deducts approved days from leave balance inside a database transaction.
- Leave events now cover `LEAVE_INFO_REQUESTED`, balance allocation/update, and permission submit/approve/reject events while continuing to publish activity, audit, notification, and search updates through subscribers.
- Added dedicated `LeaveBalancesService`, `LeaveBalancesController`, and `LeaveCalendarController` to match the Phase 2B.1 service boundaries.
- Search indexing now includes request number, employee name, leave type, reason, and department data.
- Seed data now includes:
  - annual, sick, emergency, unpaid, half-day, permission, and work-from-home leave types
  - leave balances for the sample employee
  - configurable leave settings
  - one pending leave request
  - one approved leave request for calendar/availability widgets
- Frontend Leave Requests page now includes:
  - balance summary widgets
  - remaining annual leave widget
  - pending approvals widget
  - team availability widget
  - leave calendar preview
  - workflow mode selector
  - department filter
  - duration controls in the request modal
  - request-more-information action
- Frontend Dashboard now includes API-backed time-off widgets:
  - Remaining Annual Leave
  - Pending Approvals
  - Team Away Today
  - Upcoming Team Absences
- Added `test:leave-enhancements` regression coverage.
- Added focused Phase 2B.1 test scripts:
  - `test:leave-balances`
  - `test:calendar`
  - `test:permissions`

## Implemented Phase 2B.2 Manager Hierarchy & Team Management

Implemented and validated.

Completed checkpoints:

- Inspected existing Prisma user, task, leave request, leave balance, approval workflow, event, permission, seed, and frontend structures.
- Confirmed Phase 2B.2 can extend the current architecture with a new team module instead of replacing existing Tasks or Leave Requests modules.
- Added manager hierarchy schema work:
  - `users.manager_id`
  - Prisma `manager` and `directReports` self-relations
  - manager lookup indexes
  - no-self-manager database check
- Added Phase 2B.2 migration:
  - `20260701110000_phase_2b2_team_management`
  - creates manager hierarchy schema changes
  - seeds team permissions for existing companies
  - assigns team permissions to Manager, Company Admin, and Super Admin roles
- Added team permission constants and seed matrix entries.
- Updated seed data so the sample employee reports to the sample manager.
- Updated user creation/read support for `managerId` with tenant-scoped manager validation.
- Added backend Team module:
  - `TeamService`
  - `TeamController`
  - `TeamEventsHandler`
  - `TeamModule`
- Added team endpoints for members, member detail, dashboard, leave requests, pending approvals, team approvals/rejections, availability, leave balances, team tasks, and overdue team tasks.
- Team approval endpoints enforce direct-report ownership before delegating to the existing leave approval workflow.
- Added team domain events:
  - `TEAM_LEAVE_APPROVED`
  - `TEAM_LEAVE_REJECTED`
  - `TEAM_MEMBER_ASSIGNED`
- Team event subscriber writes activity, audit logs, optional notifications, and manager-enriched search index content through existing infrastructure.
- Updated user creation to publish `TEAM_MEMBER_ASSIGNED` when a manager is assigned.
- Updated Manager role permissions so existing Manager roles lose generic leave approve/reject access and use team-only approval permissions.
- Added frontend Team module:
  - `/team` App Router page
  - `team-service.ts`
  - `TeamView`
  - Overview, Members, Leave Requests, Availability, and Tasks tabs
  - manager approval/rejection actions
  - responsive cards, filters, tables, loading states, error states, and empty states
- Added Team to the HR sidebar navigation and page-title resolver.
- Added Arabic and English `team` navigation labels.
- Connected the main Dashboard time-off widgets to the team dashboard endpoint when the signed-in user has team permissions.
- Added `test:team-management` regression coverage for:
  - manager hierarchy
  - direct-report filtering
  - approval permissions
  - tenant isolation
  - team leave balances
  - team availability
  - team tasks
  - manager dashboard data
  - team search indexing side effects
- Registered `test:team-management` in the API package and root package scripts.
- Validation checkpoint:
  - `corepack pnpm db:generate` passed.
  - `prisma migrate deploy` applied `20260701110000_phase_2b2_team_management` successfully against the local PostgreSQL database.
  - `corepack pnpm db:seed` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm test:tenant-isolation` passed.
  - `corepack pnpm test:leave-requests-core` passed.
  - `corepack pnpm test:team-management` passed after rerunning outside the sandbox due to the known `tsx` IPC pipe restriction.

Planned implementation checkpoints:

- Phase 2B.2 is ready for review.

## Implemented Phase 2C Global Search & Productivity Layer

Implemented and validated.

Completed checkpoints:

- Switched to the existing `feature/global-search` branch.
- Fast-forwarded `feature/global-search` to include the completed Phase 2B.1 and Phase 2B.2 commits before starting new work.
- Inspected the existing SearchIndexer, `search_index` schema, permission constants, seed permissions, and topbar search UI.
- Added Phase 2C database layer:
  - `saved_filters`
  - `recent_searches`
  - Prisma Company/User relations
  - shared `SavedFilterDraft` and `RecentSearchDraft` types
- Added migration `20260701130000_phase_2c_global_search`.
- Added saved-filter permissions:
  - `saved_filters:read`
  - `saved_filters:write`
- Updated API constants, shared config constants, seed permission rows, and role matrices for saved filters.
- Added unified search API layer:
  - `GET /api/v1/search`
  - `GET /api/v1/search/recent`
  - `SearchService`
  - weighted ranking logic
  - tenant isolation
  - entity-level permission filtering
  - recent-search persistence with a 20-item per-user limit
- Added saved filter API layer:
  - `GET /api/v1/saved-filters`
  - `POST /api/v1/saved-filters`
  - `PATCH /api/v1/saved-filters/:id`
  - `DELETE /api/v1/saved-filters/:id`
  - `SavedFiltersService`
- Wired SearchController, SavedFiltersController, SearchService, and SavedFiltersService into the existing SearchModule without replacing SearchIndexer.
- Improved search index coverage:
  - task indexes now include recent comments and attachment metadata
  - leave request indexes now include recent comments and attachment metadata
  - user creation indexes name, email, job title, department, and manager metadata
  - department creation indexes name, code, description, and manager metadata
  - seed data now backfills user, department, and leave request search indexes
  - seeded task indexes now include assignee and department metadata
- Added frontend global command palette:
  - topbar search button opens the modal
  - Ctrl/Cmd+K opens the modal
  - instant API-backed search
  - entity type filters
  - grouped results
  - keyboard navigation
  - recent searches
  - saved filters
  - built-in task and leave presets
  - loading, empty, and error states
  - responsive modal layout with Arabic RTL and English LTR support
- Added frontend search API service for search, recent searches, and saved filters.
- Updated Task List and Leave Requests pages to initialize filters from URL query parameters so presets and saved filters navigate into filtered views.
- Added `test:global-search` regression coverage for:
  - tenant isolation
  - entity-level permission filtering
  - ranking
  - saved filters
  - recent searches
  - command-palette API usage
- Registered `test:global-search` in the API package and root package scripts.
- Validation checkpoint:
  - `corepack pnpm db:generate` passed.
  - `prisma migrate deploy` applied `20260701130000_phase_2c_global_search` successfully against the local PostgreSQL database.
  - `corepack pnpm db:seed` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm test:tenant-isolation` passed.
  - `corepack pnpm test:global-search` passed after rerunning outside the sandbox due to the known `tsx` IPC pipe restriction.

Planned implementation checkpoints:

- Phase 2C is ready for review.

## Implemented Phase 3 Email Center

Implemented and validated.

Completed checkpoints:

- Created branch `feature/email-center` from the completed Phase 2C work.
- Inspected existing SMTP settings, BullMQ queue wrappers, EmailProvider/SmtpProvider abstraction, DomainEventBus subscribers, attachments, search indexing, permissions, seed data, and the prototype Email UI.
- Confirmed Phase 3 will extend the existing `EmailMessage` prototype into a tenant-scoped Email Center rather than creating a parallel system.
- Added Phase 3 database layer:
  - `emails`
  - `email_recipients`
  - `email_templates`
  - `email_attachments`
  - `EmailStatus`
  - `EmailRecipientKind`
  - `EmailRecipientType`
- Added migration `20260701150000_phase_3_email_center`.
- Added email permissions:
  - `emails:read`
  - `emails:create`
  - `emails:update`
  - `emails:delete`
  - `emails:send`
  - `email_templates:read`
  - `email_templates:write`
- Updated API constants, shared config constants, seed permission rows, role permission matrix, and seeded system templates.
- Added backend Email Center module:
  - `EmailsModule`
  - `EmailsController`
  - `EmailTemplatesController`
  - `EmailsService`
  - `EmailTemplatesService`
  - `EmailWorker`
  - `EmailEventsHandler`
- Added queue-based email status flow:
  - `DRAFT`
  - `QUEUED`
  - `SENDING`
  - `SENT`
  - `FAILED`
  - `CANCELLED`
- Implemented SMTP provider delivery through existing encrypted company SMTP settings, with test-only mock delivery mode.
- Added Email domain events:
  - `EMAIL_CREATED`
  - `EMAIL_UPDATED`
  - `EMAIL_QUEUED`
  - `EMAIL_SENT`
  - `EMAIL_FAILED`
  - `EMAIL_CANCELLED`
  - `EMAIL_RETRIED`
  - `EMAIL_DELETED`
  - `EMAIL_ATTACHMENT_ADDED`
- Email event subscribers now create activities, audit logs, notifications, and search indexes.
- Extended global search to include `EMAIL` results with `emails:read` permission filtering.
- Backend validation checkpoint:
  - `corepack pnpm db:generate` passed.
  - `corepack pnpm typecheck` passed.
- Replaced prototype Email UI with API-backed Email Center:
  - `/email` status tabs for inbox, sent, drafts, queued, failed, and templates
  - compose modal
  - employee and external recipients
  - TO / CC / BCC
  - template selector
  - attachment metadata
  - queue send, retry, cancel, edit, and delete actions
  - template creation and custom template deletion
  - responsive Arabic RTL and English LTR layout
- Extended command palette filters and result rendering to support `EMAIL`.
- Frontend validation checkpoint:
  - `corepack pnpm typecheck` passed.
- Added `test:email-center` regression coverage for:
  - email creation
  - template rendering
  - queue processing
  - SMTP provider integration
  - status transitions
  - retries
  - tenant isolation
  - search indexing
  - permission filtering
- Updated tenant isolation regression coverage to use the new production `emails` table.
- Final validation checkpoint:
  - `corepack pnpm db:generate` passed.
  - `prisma migrate deploy` applied `20260701150000_phase_3_email_center` successfully against the local PostgreSQL database.
  - `corepack pnpm db:seed` passed.
  - `corepack pnpm typecheck` passed.
  - `corepack pnpm lint` passed.
  - `corepack pnpm test:tenant-isolation` passed.
  - `corepack pnpm test:email-center` passed after rerunning outside the sandbox due to the known `tsx` IPC pipe restriction.
  - `corepack pnpm test:global-search` passed.

Follow-up work:

- Real binary file upload/streaming for email attachments once the StorageProvider grows read/write object methods.
- Optional inbound mailbox ingestion if Inbox becomes a true received-mail workflow.
- Super Admin SaaS portal should be the next major branch after review.

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
- Implemented Phase 2B.1 Leave Enhancements for balances, workflow settings, request-info, calendar, and availability.
- Fixed browser login `Failed to fetch` caused by CORS origin mismatch when opening the app with `127.0.0.1` instead of `localhost`.
- Updated API CORS to accept comma-separated `WEB_ORIGIN` values and added local defaults for:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  - `http://0.0.0.0:3000`
- Added `WEB_ORIGIN` to `.env.example` and Docker API environment configuration.

## Local Testing

Current development URLs:

- Web Arabic login: `http://localhost:3000/ar/login`
- Web English login: `http://localhost:3000/en/login`
- Arabic dashboard: `http://localhost:3000/ar/dashboard`
- Arabic task list: `http://localhost:3000/ar/tasks/list`
- Arabic Kanban: `http://localhost:3000/ar/tasks/kanban`
- Arabic leave requests: `http://localhost:3000/ar/leaves`
- English leave requests: `http://localhost:3000/en/leaves`
- Arabic email center: `http://localhost:3000/ar/email`
- English email center: `http://localhost:3000/en/email`
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
corepack pnpm test:leave-enhancements
corepack pnpm test:leave-balances
corepack pnpm test:calendar
corepack pnpm test:permissions
corepack pnpm test:team-management
corepack pnpm test:global-search
corepack pnpm test:email-center
```

Additional local smoke checks completed:

- Authenticated seed admin login against `http://localhost:4000/api/v1/auth/login`.
- CORS preflight for `POST /api/v1/auth/login` returns matching `Access-Control-Allow-Origin` for:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
- Login POST from both local web origins returns HTTP `201 Created`.
- Authenticated `GET /api/v1/tasks`, returning 3 seeded tenant tasks.
- Authenticated `GET /api/v1/leave-types`, returning 7 seeded leave types.
- Authenticated `GET /api/v1/leave-requests`, returning seeded pending and approved leave requests.
- Authenticated `GET /api/v1/leave-balances?year=2026`, returning 3 seeded balances.
- Authenticated `GET /api/v1/leave-balances/me?year=2026` as the seeded employee, returning 3 seeded balances.
- Authenticated `GET /api/v1/leave-settings`, returning `MANAGER_HR`.
- Authenticated `GET /api/v1/leave-requests/calendar`, returning 1 approved seeded leave request for July 2026.
- Authenticated `GET /api/v1/leave-requests/availability`, returning 1 employee on leave and 2 available employees for July 15, 2026.
- Authenticated `GET /api/v1/calendar/team`, returning 1 approved seeded leave request for July 2026.
- Authenticated `GET /api/v1/calendar/department/:id`, returning 1 approved seeded HR leave request for July 2026.
- Web route checks returned HTTP 200:
  - `/ar/tasks/list`
  - `/ar/tasks/kanban`
  - `/en/tasks/list`
  - `/en/tasks/kanban`
  - `/ar/leaves`
  - `/en/leaves`

## Remaining Work

The following modules should be implemented after Phase 3 approval:

- Task refinements:
  - richer multi-assignee editing
  - drag-and-drop Kanban status changes
  - reminder queue processors for due-soon and overdue notifications
  - uploaded binary file handling beyond attachment metadata
- Leave request refinements:
  - richer workflow editor UI beyond the current Manager-only / Manager-HR selector
  - leave accrual policy automation
  - public holiday calendars
- Email refinements:
  - real binary file upload and attachment streaming through StorageProvider
  - optional inbound mailbox ingestion if Inbox becomes a received-mail workflow
- Real company switcher behavior for Super Admin users.
- Super Admin SaaS portal for tenant management, usage metrics, platform settings, and company switching.

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
- `c811b71 Implement Phase 2B leave requests`
- `Implement Phase 2B.1 leave enhancements`
- `925603c Fix local login CORS origins`
- `Align time-off enhancements with Phase 2B.1 scope`
- `Implement Phase 2B.2 manager hierarchy and team management`
- `Implement Phase 2C global search and productivity layer`
- `Implement Phase 3 email center`
