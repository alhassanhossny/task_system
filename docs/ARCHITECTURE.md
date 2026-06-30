# Phase 1 Architecture

## Source Of Truth

The approved Figma export remains the source of truth for UI hierarchy, navigation, colors, spacing, typography, RTL behavior, dark/light mode, and screen composition. The frontend work refactors that implementation into production modules instead of redesigning it.

The only intentional UI adjustments before coding are:

- Company switcher in the top bar for Super Admin tenant context.
- Global search in the header.
- Notification drawer instead of a dropdown.

## Monorepo

The repo uses pnpm workspaces with `apps/web`, `apps/api`, and shared packages under `packages/*`.

- `packages/ui` contains the exported shadcn/ui primitives and theme CSS.
- `packages/types` contains frontend/backend contracts and Phase 2-only interfaces.
- `packages/config` contains stable cross-app constants such as locales, roles, permissions, and the tenant header.
- `packages/shared` contains generic API envelope/error helpers.

This keeps app code thin while avoiding hidden coupling between the web and API.

## Backend

The API is NestJS with Prisma and PostgreSQL. Prisma lives under `apps/api/prisma` because the API owns the generated client, migrations, and seed data.

Global guards run in this order:

1. JWT guard authenticates all non-public requests.
2. Tenant guard resolves `request.companyId` from the user tenant or `x-company-id` for `SUPER_ADMIN`.
3. Role guard enforces route role metadata.
4. Permission guard enforces route permission metadata.

All foundation service reads and writes include `companyId` except platform company listing for `SUPER_ADMIN`.

## Database

All tables use UUID primary keys and include:

- `id`
- `created_at`
- `updated_at`
- `deleted_at`

Business tables include `company_id`, including join tables. Soft deletion is modeled with `deleted_at`; Phase 1 queries filter it explicitly.

The required foundation tables are implemented:

- `companies`
- `users`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `departments`
- `audit_logs`
- `activities`

Authentication adds `refresh_tokens`.

Phase 2 placeholders are schema-only:

- `tasks`
- `task_assignees`
- `leave_requests`
- `email_messages`

## Frontend

The Next.js app uses locale route groups:

- `/(auth)/login`
- `/(app)/dashboard`
- `/(app)/tasks/kanban`
- `/(app)/tasks/list`
- `/(app)/leaves`
- `/(app)/email`
- `/(app)/employees`
- `/(app)/super-admin`

The former single `App.tsx` state switch is replaced by URL-driven routing, a shared app shell, and feature-specific view modules.

Providers are centralized:

- `next-intl` for Arabic and English.
- `next-themes` for dark/light mode.
- TanStack Query for server state.
- `AuthProvider` for session storage.

Forms use React Hook Form and Zod. The login screen calls the API auth service and stores the returned JWT session.

## Phase 2 Boundary

Tasks, leave requests, and emails keep their approved prototype UI in the frontend, but the backend implementation is intentionally absent. Phase 2 should add scoped Nest modules, API services, validation DTOs, permissions, mutations, and React Query integration for those modules.
