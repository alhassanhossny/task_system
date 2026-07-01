CREATE TABLE "saved_filters" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "entity_type" "entity_type" NOT NULL,
  "name" TEXT NOT NULL,
  "filter_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recent_searches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "query" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "recent_searches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_filters_company_id_user_id_entity_type_name_key"
  ON "saved_filters"("company_id", "user_id", "entity_type", "name");
CREATE INDEX "saved_filters_company_id_user_id_entity_type_idx"
  ON "saved_filters"("company_id", "user_id", "entity_type");
CREATE INDEX "saved_filters_user_id_idx" ON "saved_filters"("user_id");

CREATE UNIQUE INDEX "recent_searches_company_id_user_id_query_key"
  ON "recent_searches"("company_id", "user_id", "query");
CREATE INDEX "recent_searches_company_id_user_id_created_at_idx"
  ON "recent_searches"("company_id", "user_id", "created_at");
CREATE INDEX "recent_searches_user_id_idx" ON "recent_searches"("user_id");

ALTER TABLE "saved_filters"
  ADD CONSTRAINT "saved_filters_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "saved_filters"
  ADD CONSTRAINT "saved_filters_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recent_searches"
  ADD CONSTRAINT "recent_searches_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recent_searches"
  ADD CONSTRAINT "recent_searches_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

WITH new_permissions(action, subject, description) AS (
  VALUES
    ('read', 'saved_filters', 'Read saved filters'),
    ('write', 'saved_filters', 'Create and update saved filters')
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

WITH saved_filter_permissions(action, subject) AS (
  VALUES
    ('read', 'saved_filters'),
    ('write', 'saved_filters')
)
INSERT INTO "role_permissions" ("id", "company_id", "role_id", "permission_id", "created_at", "updated_at")
SELECT gen_random_uuid(), r."company_id", r."id", p."id", now(), now()
FROM "roles" r
JOIN saved_filter_permissions sp ON true
JOIN "permissions" p
  ON p."company_id" = r."company_id"
  AND p."action" = sp.action
  AND p."subject" = sp.subject
WHERE r."system_name" IN ('SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'EMPLOYEE')
  AND r."deleted_at" IS NULL
  AND p."deleted_at" IS NULL
ON CONFLICT ("company_id", "role_id", "permission_id")
DO UPDATE SET
  "deleted_at" = NULL,
  "updated_at" = now();
