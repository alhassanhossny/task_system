ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'TASK_OVERDUE';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'LEAVE_REJECTED';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'LEAVE_CANCELLED';

CREATE TABLE "leave_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "is_paid" BOOLEAN NOT NULL DEFAULT true,
  "annual_allowance_days" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "leave_requests" ADD COLUMN "leave_type_id" UUID;
ALTER TABLE "leave_requests" ADD COLUMN "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "leave_requests" ADD COLUMN "approved_at" TIMESTAMPTZ(6);
ALTER TABLE "leave_requests" ADD COLUMN "rejected_at" TIMESTAMPTZ(6);
ALTER TABLE "leave_requests" ADD COLUMN "cancelled_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "leave_types_company_id_code_key" ON "leave_types"("company_id", "code");
CREATE INDEX "leave_types_company_id_is_active_idx" ON "leave_types"("company_id", "is_active");
CREATE INDEX "leave_requests_company_id_leave_type_id_idx" ON "leave_requests"("company_id", "leave_type_id");

ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
