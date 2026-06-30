ALTER TABLE "tasks" ADD COLUMN "task_number" TEXT;
ALTER TABLE "tasks" ADD COLUMN "completed_at" TIMESTAMPTZ(6);
ALTER TABLE "tasks" ADD COLUMN "reminder_sent_at" TIMESTAMPTZ(6);
ALTER TABLE "tasks" ADD COLUMN "estimated_hours" DECIMAL(8, 2);
ALTER TABLE "tasks" ADD COLUMN "actual_hours" DECIMAL(8, 2);

WITH numbered_tasks AS (
  SELECT
    "id",
    'TASK-' || LPAD(ROW_NUMBER() OVER (PARTITION BY "company_id" ORDER BY "created_at", "id")::TEXT, 5, '0') AS "task_number"
  FROM "tasks"
)
UPDATE "tasks"
SET "task_number" = numbered_tasks."task_number"
FROM numbered_tasks
WHERE "tasks"."id" = numbered_tasks."id";

ALTER TABLE "tasks" ALTER COLUMN "task_number" SET NOT NULL;

CREATE TABLE "task_watchers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "task_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "task_watchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tasks_company_id_task_number_key" ON "tasks"("company_id", "task_number");
CREATE INDEX "tasks_company_id_priority_idx" ON "tasks"("company_id", "priority");
CREATE INDEX "tasks_company_id_due_at_idx" ON "tasks"("company_id", "due_at");
CREATE INDEX "task_assignees_task_id_idx" ON "task_assignees"("task_id");
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");
CREATE UNIQUE INDEX "task_watchers_company_id_task_id_user_id_key" ON "task_watchers"("company_id", "task_id", "user_id");
CREATE INDEX "task_watchers_company_id_idx" ON "task_watchers"("company_id");
CREATE INDEX "task_watchers_task_id_idx" ON "task_watchers"("task_id");
CREATE INDEX "task_watchers_user_id_idx" ON "task_watchers"("user_id");

ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_watchers" ADD CONSTRAINT "task_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
