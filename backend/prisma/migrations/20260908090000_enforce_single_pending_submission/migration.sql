-- At most one PENDING_REVIEW submission per student.
--
-- This partial unique index is the database concurrency backstop for initial
-- submissions: two concurrent creations by the same student cannot both commit
-- a PENDING_REVIEW row, because the losing insert violates this index instead
-- of producing a second live review.
--
-- Only PENDING_REVIEW rows are inside the index. AWAITING_REVISION, APPROVED
-- and REJECTED rows are outside it, so full submission history and revision
-- lineages are retained untouched, and a decision moving a row off
-- PENDING_REVIEW releases the slot automatically. The stricter workflow policy
-- (one live topic-approval process per student; only REJECTED frees a fresh
-- start) is enforced in the service layer, not here.
--
-- Additive only: no row is modified or deleted. If a database already contains
-- more than one PENDING_REVIEW submission for the same student, creating this
-- index fails, and that failure is correct — such rows must be inspected and
-- resolved explicitly, never auto-deleted by a migration.
CREATE UNIQUE INDEX "submissions_one_pending_per_student_key"
ON "submissions"("student_id")
WHERE "status" = 'PENDING_REVIEW'::"SubmissionStatus";
