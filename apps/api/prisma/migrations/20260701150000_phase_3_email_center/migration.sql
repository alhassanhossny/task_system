CREATE TYPE "email_status" AS ENUM ('draft', 'queued', 'sending', 'sent', 'failed', 'cancelled');
CREATE TYPE "email_recipient_kind" AS ENUM ('to', 'cc', 'bcc');
CREATE TYPE "email_recipient_type" AS ENUM ('employee', 'client', 'external');

ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'EMAIL_QUEUED';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'EMAIL_FAILED';

CREATE TABLE "email_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "created_by_id" UUID,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emails" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "created_by_id" UUID,
  "template_id" UUID,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "email_status" NOT NULL DEFAULT 'draft',
  "from_name" TEXT,
  "from_email" TEXT,
  "reply_to" TEXT,
  "queued_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "failure_reason" TEXT,
  "provider" TEXT,
  "provider_message_id" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_recipients" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "email_id" UUID NOT NULL,
  "user_id" UUID,
  "recipient_type" "email_recipient_type" NOT NULL DEFAULT 'external',
  "recipient_kind" "email_recipient_kind" NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "email_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "email_id" UUID NOT NULL,
  "attachment_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_templates_company_id_name_key" ON "email_templates"("company_id", "name");
CREATE INDEX "email_templates_company_id_is_system_idx" ON "email_templates"("company_id", "is_system");
CREATE INDEX "email_templates_created_by_id_idx" ON "email_templates"("created_by_id");

CREATE INDEX "emails_company_id_status_created_at_idx" ON "emails"("company_id", "status", "created_at");
CREATE INDEX "emails_company_id_created_at_idx" ON "emails"("company_id", "created_at");
CREATE INDEX "emails_created_by_id_idx" ON "emails"("created_by_id");
CREATE INDEX "emails_template_id_idx" ON "emails"("template_id");

CREATE UNIQUE INDEX "email_recipients_company_id_email_id_recipient_kind_email_key"
  ON "email_recipients"("company_id", "email_id", "recipient_kind", "email");
CREATE INDEX "email_recipients_company_id_email_id_idx" ON "email_recipients"("company_id", "email_id");
CREATE INDEX "email_recipients_company_id_email_idx" ON "email_recipients"("company_id", "email");
CREATE INDEX "email_recipients_user_id_idx" ON "email_recipients"("user_id");

CREATE UNIQUE INDEX "email_attachments_company_id_email_id_attachment_id_key"
  ON "email_attachments"("company_id", "email_id", "attachment_id");
CREATE INDEX "email_attachments_company_id_email_id_idx" ON "email_attachments"("company_id", "email_id");
CREATE INDEX "email_attachments_attachment_id_idx" ON "email_attachments"("attachment_id");

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_templates"
  ADD CONSTRAINT "email_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "emails"
  ADD CONSTRAINT "emails_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "emails"
  ADD CONSTRAINT "emails_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "emails"
  ADD CONSTRAINT "emails_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "email_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_recipients"
  ADD CONSTRAINT "email_recipients_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_recipients"
  ADD CONSTRAINT "email_recipients_email_id_fkey"
  FOREIGN KEY ("email_id") REFERENCES "emails"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_recipients"
  ADD CONSTRAINT "email_recipients_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  ADD CONSTRAINT "email_attachments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  ADD CONSTRAINT "email_attachments_email_id_fkey"
  FOREIGN KEY ("email_id") REFERENCES "emails"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_attachments"
  ADD CONSTRAINT "email_attachments_attachment_id_fkey"
  FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

WITH new_permissions(action, subject, description) AS (
  VALUES
    ('read', 'emails', 'Read emails'),
    ('create', 'emails', 'Create email drafts'),
    ('update', 'emails', 'Update email drafts'),
    ('delete', 'emails', 'Delete emails'),
    ('send', 'emails', 'Send emails'),
    ('read', 'email_templates', 'Read email templates'),
    ('write', 'email_templates', 'Create and update email templates'),
    ('manage', 'email_templates', 'Manage email templates')
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

WITH admin_permissions(action, subject) AS (
  VALUES
    ('read', 'emails'),
    ('create', 'emails'),
    ('update', 'emails'),
    ('delete', 'emails'),
    ('send', 'emails'),
    ('read', 'email_templates'),
    ('write', 'email_templates'),
    ('manage', 'email_templates')
),
manager_permissions(action, subject) AS (
  VALUES
    ('read', 'emails'),
    ('create', 'emails'),
    ('update', 'emails'),
    ('delete', 'emails'),
    ('send', 'emails'),
    ('read', 'email_templates'),
    ('write', 'email_templates')
),
employee_permissions(action, subject) AS (
  VALUES
    ('read', 'emails'),
    ('create', 'emails'),
    ('update', 'emails'),
    ('send', 'emails'),
    ('read', 'email_templates')
),
role_permission_keys AS (
  SELECT 'SUPER_ADMIN'::"system_role" AS system_name, action, subject FROM admin_permissions
  UNION ALL
  SELECT 'COMPANY_ADMIN'::"system_role" AS system_name, action, subject FROM admin_permissions
  UNION ALL
  SELECT 'MANAGER'::"system_role" AS system_name, action, subject FROM manager_permissions
  UNION ALL
  SELECT 'EMPLOYEE'::"system_role" AS system_name, action, subject FROM employee_permissions
)
INSERT INTO "role_permissions" ("id", "company_id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), r."company_id", r."id", p."id", now(), now()
FROM "roles" r
JOIN role_permission_keys rpk ON rpk.system_name = r."system_name"
JOIN "permissions" p
  ON p."company_id" = r."company_id"
  AND p."action" = rpk.action
  AND p."subject" = rpk.subject
WHERE r."deleted_at" IS NULL
  AND p."deleted_at" IS NULL
ON CONFLICT ("company_id", "role_id", "permission_id")
DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = now();
