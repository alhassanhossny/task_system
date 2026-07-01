ALTER TYPE "leave_status" ADD VALUE IF NOT EXISTS 'info_requested';

CREATE TYPE "leave_duration_type" AS ENUM ('full_day', 'half_day', 'hours');
CREATE TYPE "leave_half_day_period" AS ENUM ('morning', 'afternoon');
CREATE TYPE "leave_approval_mode" AS ENUM ('manager_only', 'manager_hr');

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'LEAVE_INFO_REQUESTED';

ALTER TABLE "leave_requests"
  ADD COLUMN "duration_type" "leave_duration_type" NOT NULL DEFAULT 'full_day',
  ADD COLUMN "duration_days" DECIMAL(5, 2) NOT NULL DEFAULT 1,
  ADD COLUMN "duration_hours" DECIMAL(5, 2),
  ADD COLUMN "half_day_period" "leave_half_day_period",
  ADD COLUMN "info_requested_at" TIMESTAMPTZ(6);

CREATE TABLE "leave_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "leave_type_id" UUID NOT NULL,
  "allocated_days" DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "used_days" DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "remaining_days" DECIMAL(6, 2) NOT NULL DEFAULT 0,
  "year" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "leave_balances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "approval_mode" "leave_approval_mode" NOT NULL DEFAULT 'manager_hr',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "leave_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leave_balances_company_id_employee_id_leave_type_id_year_key"
  ON "leave_balances"("company_id", "employee_id", "leave_type_id", "year");
CREATE INDEX "leave_balances_company_id_employee_id_year_idx"
  ON "leave_balances"("company_id", "employee_id", "year");
CREATE INDEX "leave_balances_leave_type_id_idx"
  ON "leave_balances"("leave_type_id");
CREATE UNIQUE INDEX "leave_settings_company_id_key"
  ON "leave_settings"("company_id");

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balances_leave_type_id_fkey"
  FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_settings"
  ADD CONSTRAINT "leave_settings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
