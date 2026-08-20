-- Identity initial-access foundation (additive only).
--
-- 1. Adds forced-first-password-change state, credential/session versioning,
--    and optional student matric-number identity to users.
-- 2. Canonicalizes stored emails to the application's lower-case rule.
--    If two existing rows would collide after lower-casing, the migration
--    stops with an explicit error instead of silently merging or destroying
--    accounts; an operator must resolve the duplicate accounts first.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "matric_number" VARCHAR(50),
ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "credential_version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "users_matric_number_key" ON "users"("matric_number");

-- Canonicalize existing emails safely.
DO $$
DECLARE
  colliding_email TEXT;
BEGIN
  SELECT lower(email)
  INTO colliding_email
  FROM "users"
  GROUP BY lower(email)
  HAVING count(*) > 1
  LIMIT 1;

  IF colliding_email IS NOT NULL THEN
    RAISE EXCEPTION
      'Email canonicalization aborted: multiple accounts collide on case-insensitive email %. Resolve the duplicate accounts manually, then re-run this migration.',
      colliding_email;
  END IF;

  UPDATE "users" SET email = lower(email) WHERE email <> lower(email);
END $$;
