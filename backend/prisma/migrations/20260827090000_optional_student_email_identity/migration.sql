-- Optional student email identity (additive only).
--
-- Students at the target institution are not issued university email
-- addresses, so possession of a unique personal address must not be a
-- prerequisite for creating a student account. This migration relaxes
-- users.email to NULL-able and leaves every existing row untouched.
--
-- Why this is safe for uniqueness: PostgreSQL treats NULLs as distinct in a
-- unique index, so "users_email_key" continues to reject duplicate addresses
-- while permitting any number of rows with no address at all. The index is
-- deliberately left exactly as it is.
--
-- What this migration does NOT do:
--   * it does not delete or blank any existing email;
--   * it does not invent matric numbers for anyone;
--   * it does not make matric_number NOT NULL, because lecturers and
--     administrators legitimately have none. "A student must have a matric
--     number" is a role-specific invariant enforced at the service boundary
--     and covered by tests.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Advisory data audit.
--
-- Report any existing STUDENT row that has no matric number. Such a row can
-- still authenticate by email, but it does not satisfy the student identity
-- contract and an operator should correct it through the administrative
-- identity-correction path. This is deliberately a NOTICE and not an
-- exception: legacy development seed data is known to contain students
-- without matric numbers, and failing the deployment of an additive column
-- change over pre-existing seed rows would be the wrong trade.
DO $$
DECLARE
  students_without_matric INTEGER;
  students_without_email INTEGER;
BEGIN
  SELECT count(*) INTO students_without_matric
  FROM "users"
  WHERE "role" = 'STUDENT' AND "matric_number" IS NULL;

  SELECT count(*) INTO students_without_email
  FROM "users"
  WHERE "role" = 'STUDENT' AND "email" IS NULL;

  IF students_without_matric > 0 THEN
    RAISE NOTICE 'Identity audit: % student account(s) have no matric number. They remain usable but do not satisfy the student identity contract; correct them through admin identity correction.', students_without_matric;
  END IF;

  RAISE NOTICE 'Identity audit: % student account(s) currently have no email address.', students_without_email;
END $$;
