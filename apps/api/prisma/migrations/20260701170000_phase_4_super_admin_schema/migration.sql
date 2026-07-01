CREATE TYPE "subscription_status" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE "billing_interval" AS ENUM ('monthly', 'yearly');
CREATE TYPE "subscription_invoice_status" AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE "company_switch_status" AS ENUM ('active', 'ended', 'revoked', 'expired');
CREATE TYPE "platform_setting_value_type" AS ENUM ('string', 'number', 'boolean', 'json', 'secret');

ALTER TABLE "companies"
  ADD COLUMN "primary_domain" TEXT,
  ADD COLUMN "billing_email" TEXT,
  ADD COLUMN "support_email" TEXT,
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN "trial_ends_at" TIMESTAMPTZ(6),
  ADD COLUMN "suspended_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "companies_primary_domain_key" ON "companies"("primary_domain");
CREATE INDEX "companies_status_idx" ON "companies"("status");
CREATE INDEX "companies_plan_idx" ON "companies"("plan");
CREATE INDEX "companies_trial_ends_at_idx" ON "companies"("trial_ends_at");

CREATE TABLE "subscription_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "tier" "company_plan" NOT NULL DEFAULT 'starter',
  "monthly_price" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "yearly_price" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "max_users" INTEGER,
  "max_storage_mb" INTEGER,
  "max_companies" INTEGER,
  "features" JSONB NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_plans_monthly_price_check" CHECK ("monthly_price" >= 0),
  CONSTRAINT "subscription_plans_yearly_price_check" CHECK ("yearly_price" >= 0),
  CONSTRAINT "subscription_plans_max_users_check" CHECK ("max_users" IS NULL OR "max_users" > 0),
  CONSTRAINT "subscription_plans_max_storage_mb_check" CHECK ("max_storage_mb" IS NULL OR "max_storage_mb" > 0),
  CONSTRAINT "subscription_plans_max_companies_check" CHECK ("max_companies" IS NULL OR "max_companies" > 0)
);

CREATE TABLE "company_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" "subscription_status" NOT NULL DEFAULT 'trialing',
  "billing_interval" "billing_interval" NOT NULL DEFAULT 'monthly',
  "seats" INTEGER NOT NULL DEFAULT 1,
  "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "trial_ends_at" TIMESTAMPTZ(6),
  "current_period_start" TIMESTAMPTZ(6),
  "current_period_end" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "company_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_subscriptions_seats_check" CHECK ("seats" > 0),
  CONSTRAINT "company_subscriptions_period_check" CHECK (
    "current_period_start" IS NULL
    OR "current_period_end" IS NULL
    OR "current_period_end" >= "current_period_start"
  )
);

CREATE TABLE "subscription_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "subscription_id" UUID,
  "invoice_number" TEXT NOT NULL,
  "status" "subscription_invoice_status" NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "amount_due" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "amount_paid" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "due_at" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "voided_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subscription_invoices_amount_due_check" CHECK ("amount_due" >= 0),
  CONSTRAINT "subscription_invoices_amount_paid_check" CHECK ("amount_paid" >= 0)
);

CREATE TABLE "platform_usage_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "period_start" TIMESTAMPTZ(6) NOT NULL,
  "period_end" TIMESTAMPTZ(6) NOT NULL,
  "users_count" INTEGER NOT NULL DEFAULT 0,
  "active_users_count" INTEGER NOT NULL DEFAULT 0,
  "tasks_count" INTEGER NOT NULL DEFAULT 0,
  "open_tasks_count" INTEGER NOT NULL DEFAULT 0,
  "leave_requests_count" INTEGER NOT NULL DEFAULT 0,
  "emails_sent_count" INTEGER NOT NULL DEFAULT 0,
  "storage_bytes" BIGINT NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "platform_usage_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_usage_snapshots_period_check" CHECK ("period_end" > "period_start"),
  CONSTRAINT "platform_usage_snapshots_counts_check" CHECK (
    "users_count" >= 0
    AND "active_users_count" >= 0
    AND "tasks_count" >= 0
    AND "open_tasks_count" >= 0
    AND "leave_requests_count" >= 0
    AND "emails_sent_count" >= 0
    AND "storage_bytes" >= 0
  )
);

CREATE TABLE "company_switch_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "actor_company_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "status" "company_switch_status" NOT NULL DEFAULT 'active',
  "reason" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "ended_at" TIMESTAMPTZ(6),
  "revoked_at" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "company_switch_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_switch_sessions_expires_check" CHECK ("expires_at" > "started_at")
);

CREATE TABLE "platform_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "value_type" "platform_setting_value_type" NOT NULL DEFAULT 'string',
  "description" TEXT,
  "is_secret" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");
CREATE INDEX "subscription_plans_tier_is_active_idx" ON "subscription_plans"("tier", "is_active");

CREATE INDEX "company_subscriptions_company_id_status_idx" ON "company_subscriptions"("company_id", "status");
CREATE INDEX "company_subscriptions_plan_id_status_idx" ON "company_subscriptions"("plan_id", "status");
CREATE INDEX "company_subscriptions_current_period_end_idx" ON "company_subscriptions"("current_period_end");

CREATE UNIQUE INDEX "subscription_invoices_company_id_invoice_number_key" ON "subscription_invoices"("company_id", "invoice_number");
CREATE INDEX "subscription_invoices_company_id_status_due_at_idx" ON "subscription_invoices"("company_id", "status", "due_at");
CREATE INDEX "subscription_invoices_subscription_id_idx" ON "subscription_invoices"("subscription_id");

CREATE UNIQUE INDEX "platform_usage_snapshots_company_id_period_start_period_end_key"
  ON "platform_usage_snapshots"("company_id", "period_start", "period_end");
CREATE INDEX "platform_usage_snapshots_company_id_period_end_idx" ON "platform_usage_snapshots"("company_id", "period_end");

CREATE INDEX "company_switch_sessions_company_id_status_idx" ON "company_switch_sessions"("company_id", "status");
CREATE INDEX "company_switch_sessions_actor_user_id_status_idx" ON "company_switch_sessions"("actor_user_id", "status");
CREATE INDEX "company_switch_sessions_expires_at_idx" ON "company_switch_sessions"("expires_at");

CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");
CREATE INDEX "platform_settings_value_type_idx" ON "platform_settings"("value_type");

ALTER TABLE "company_subscriptions"
  ADD CONSTRAINT "company_subscriptions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_subscriptions"
  ADD CONSTRAINT "company_subscriptions_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_invoices"
  ADD CONSTRAINT "subscription_invoices_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "subscription_invoices"
  ADD CONSTRAINT "subscription_invoices_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "company_subscriptions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_usage_snapshots"
  ADD CONSTRAINT "platform_usage_snapshots_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_switch_sessions"
  ADD CONSTRAINT "company_switch_sessions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_switch_sessions"
  ADD CONSTRAINT "company_switch_sessions_actor_company_id_fkey"
  FOREIGN KEY ("actor_company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_switch_sessions"
  ADD CONSTRAINT "company_switch_sessions_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
