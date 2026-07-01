ALTER TABLE "users" ADD COLUMN "manager_id" UUID;

ALTER TABLE "users"
  ADD CONSTRAINT "users_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
  ADD CONSTRAINT "users_manager_id_not_self_check"
  CHECK ("manager_id" IS NULL OR "manager_id" <> "id");

CREATE INDEX "users_manager_id_idx" ON "users"("manager_id");
CREATE INDEX "users_company_id_manager_id_idx" ON "users"("company_id", "manager_id");

WITH new_permissions(action, subject, description) AS (
  VALUES
    ('view_team', 'users', 'View direct reports'),
    ('view_team', 'leave_requests', 'View direct-report leave requests'),
    ('approve_team', 'leave_requests', 'Approve direct-report leave requests'),
    ('reject_team', 'leave_requests', 'Reject direct-report leave requests'),
    ('view_team', 'calendar', 'View direct-report availability calendar'),
    ('view_team', 'tasks', 'View direct-report tasks'),
    ('assign_team', 'tasks', 'Assign tasks to direct reports')
)
INSERT INTO "permissions" ("id", "company_id", "action", "subject", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), c."id", p.action, p.subject, p.description, now(), now()
FROM "companies" c
CROSS JOIN new_permissions p
WHERE c."deleted_at" IS NULL
ON CONFLICT ("company_id", "action", "subject")
DO UPDATE SET
  "description" = EXCLUDED."description",
  "deleted_at" = NULL,
  "updated_at" = now();

WITH team_permissions(action, subject) AS (
  VALUES
    ('view_team', 'users'),
    ('view_team', 'leave_requests'),
    ('approve_team', 'leave_requests'),
    ('reject_team', 'leave_requests'),
    ('view_team', 'calendar'),
    ('view_team', 'tasks'),
    ('assign_team', 'tasks')
)
INSERT INTO "role_permissions" ("id", "company_id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), r."company_id", r."id", p."id", now(), now()
FROM "roles" r
JOIN team_permissions tp ON true
JOIN "permissions" p
  ON p."company_id" = r."company_id"
  AND p."action" = tp.action
  AND p."subject" = tp.subject
WHERE r."system_name" = 'MANAGER'
  AND r."deleted_at" IS NULL
  AND p."deleted_at" IS NULL
ON CONFLICT ("company_id", "role_id", "permission_id")
DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = now();

UPDATE "role_permissions" rp
SET "deleted_at" = now(),
    "updated_at" = now()
FROM "roles" r
JOIN "permissions" p ON p."company_id" = r."company_id"
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."system_name" = 'MANAGER'
  AND p."subject" = 'leave_requests'
  AND p."action" IN ('approve', 'reject')
  AND rp."deleted_at" IS NULL;

INSERT INTO "role_permissions" ("id", "company_id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), r."company_id", r."id", p."id", now(), now()
FROM "roles" r
JOIN "permissions" p ON p."company_id" = r."company_id"
WHERE r."system_name" IN ('SUPER_ADMIN', 'COMPANY_ADMIN')
  AND r."deleted_at" IS NULL
  AND p."deleted_at" IS NULL
ON CONFLICT ("company_id", "role_id", "permission_id")
DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = now();
