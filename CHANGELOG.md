# Changelog

All notable changes to TASK Flow SaaS are documented here.

## v1.0.0-beta - 2026-07-07

### Release Scope

This beta release establishes a stable baseline before Phase 5 production-hardening work. It includes the completed SaaS foundation, core business modules, platform administration backend, and Super Admin web dashboard.

### Added

- Multi-tenant SaaS foundation with tenant-scoped business data.
- JWT authentication with refresh token support.
- Role and permission based access control.
- Tenant, role, permission, and platform authorization guards.
- Companies, users, departments, roles, permissions, audit logs, activities, notifications, comments, attachments, tags, search index, approval workflows, SMTP settings, user preferences, and platform settings.
- Next.js 15 frontend with Arabic RTL and English LTR support.
- Dark and light theme support.
- Task management with list, Kanban, assignment, watchers, comments, attachments, activity timeline, notifications, audit logs, and search indexing.
- Leave and time-off management with configurable workflows, leave types, balances, half-day leave, hourly permissions, calendars, availability, comments, attachments, activities, notifications, audit logs, and search indexing.
- Manager hierarchy and team management with direct-report visibility, team approvals, team availability, team balances, and team tasks.
- Global search and productivity layer with unified search API, command palette, recent searches, and saved filters.
- Email Center with email records, recipients, templates, queued SMTP sending, retries, status tracking, attachments metadata, events, activities, notifications, audit logs, and search indexing.
- Super Admin platform database schema for subscription plans, company subscriptions, invoices, usage snapshots, company switch sessions, and platform settings.
- Super Admin permissions and platform/tenant permission separation.
- Platform Administration backend APIs for company management, subscriptions, tenant switching, analytics, usage snapshots, platform settings placeholders, and endpoint-level security tests.
- Platform usage snapshot BullMQ worker and daily repeatable scheduler.
- Optimized platform analytics queries using grouped aggregation.
- Super Admin web dashboard with Platform navigation, companies, subscriptions, plans, analytics, settings, and switch sessions.
- `AGENTS.md` with setup, architecture, validation, and migration-freeze guidance for continuing work on another machine.

### Security

- Automated tenant isolation coverage for users, tasks, and emails.
- Endpoint-level Platform Administration authorization tests covering Super Admin, Company Admin, Manager, Employee, anonymous, invalid JWT, expired JWT, revoked switch token, and suspended tenant access.
- Permission-scoped Platform navigation and frontend action controls.
- Suspended company access enforcement.
- Tenant switch sessions with expiration, duplicate active session prevention, and explicit end-session flow.
- Secret-pattern scan is part of the release checklist.

### Fixed

- Leave request search indexing now includes manager metadata so team approval search enrichment remains deterministic regardless of subscriber execution order.

### Validation

- Full local validation target for this beta:
  - `corepack pnpm typecheck`
  - `corepack pnpm lint`
  - `corepack pnpm test:tenant-isolation`
  - `corepack pnpm test:tasks-core`
  - `corepack pnpm test:leave-requests-core`
  - `corepack pnpm test:leave-enhancements`
  - `corepack pnpm test:leave-balances`
  - `corepack pnpm test:calendar`
  - `corepack pnpm test:permissions`
  - `corepack pnpm test:team-management`
  - `corepack pnpm test:global-search`
  - `corepack pnpm test:email-center`
  - `corepack pnpm test:platform-company-management`
  - `corepack pnpm test:platform-subscriptions`
  - `corepack pnpm test:platform-company-switching`
  - `corepack pnpm test:platform-analytics`
  - `corepack pnpm test:platform-usage-snapshots`
  - `corepack pnpm test:platform-security`
  - `corepack pnpm test:platform-dashboard`

### Migration Freeze

- Database migrations are frozen at the v1.0.0-beta baseline.
- New migrations should only be added for approved Phase 5 work or critical fixes that cannot be handled without schema changes.
- Existing migrations must not be edited after this tag.

### Known Follow-Up

- Remote push and CI verification require GitHub credentials on the machine running the release.
- Real binary file upload and object storage methods remain future production-hardening work.
- Monitoring, structured logging, rate limiting, and additional operational hardening remain Phase 5 candidates.
