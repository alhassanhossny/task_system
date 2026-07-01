ALTER TYPE "leave_duration_type" ADD VALUE IF NOT EXISTS 'half_day_am';
ALTER TYPE "leave_duration_type" ADD VALUE IF NOT EXISTS 'half_day_pm';

CREATE TYPE "leave_request_type" AS ENUM ('leave', 'permission');

ALTER TABLE "leave_requests"
  ADD COLUMN "request_number" TEXT,
  ADD COLUMN "request_type" "leave_request_type" NOT NULL DEFAULT 'leave',
  ADD COLUMN "start_time" TIMESTAMPTZ(6),
  ADD COLUMN "end_time" TIMESTAMPTZ(6);

UPDATE "leave_requests"
SET "request_type" = 'permission'
WHERE "duration_type" = 'hours';

UPDATE "leave_requests"
SET "request_number" = 'LR-' || LPAD(row_number::TEXT, 5, '0')
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "company_id" ORDER BY "created_at", "id") AS row_number
  FROM "leave_requests"
  WHERE "request_number" IS NULL
) numbered
WHERE "leave_requests"."id" = numbered."id";

CREATE UNIQUE INDEX "leave_requests_company_id_request_number_key"
  ON "leave_requests"("company_id", "request_number");
CREATE INDEX "leave_requests_company_id_request_type_idx"
  ON "leave_requests"("company_id", "request_type");
