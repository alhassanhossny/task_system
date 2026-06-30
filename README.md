# TASK Flow SaaS

Phase 1 converts the approved Figma export into a production-oriented multi-tenant SaaS foundation.

## Structure

```text
apps/
  web   Next.js 15 App Router frontend
  api   NestJS API
packages/
  ui       shadcn/ui primitives and approved theme CSS
  types    shared domain contracts
  config   roles, permissions, locales, tenant constants
  shared   API utility types
apps/api/prisma/
  schema.prisma, migrations, seed.ts
```

## Local Setup

```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: `http://localhost:3000/ar/login`

API: `http://localhost:4000/api`

Swagger: `http://localhost:4000/docs`

Seed login:

```text
admin@company.com
Password123!
```

## Phase Boundary

Phase 1 implements foundation resources only: authentication, companies, users, roles, permissions, departments, audit logs, activities, tenant guards, role guards, permission guards, i18n, theme, and the refactored frontend shell.

Phase 1.5 adds reusable infrastructure before feature modules: generic attachments, generic comments, persistent notifications, SMTP settings with encrypted passwords, Redis/BullMQ email queue infrastructure, search index, approval workflow tables, tags, and user preferences.

Tasks, leave requests, and email center are not implemented as backend modules in Phase 1. Their database tables and shared TypeScript interfaces exist so Phase 2 can add services without changing the foundation.
