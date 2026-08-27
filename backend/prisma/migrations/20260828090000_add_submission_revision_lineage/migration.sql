-- Topic-level revision lineage for student submissions.
--
-- Additive only. Existing submissions keep NULL `revision_of_id` and remain
-- valid: a NULL simply means "this submission is not a revision of anything".
-- No existing row is rewritten and no existing migration is edited.

ALTER TABLE "submissions" ADD COLUMN "revision_of_id" INTEGER;

-- One original may be revised at most once. This is the race guard: two
-- concurrent resubmissions of the same AWAITING_REVISION submission cannot both
-- win, because the second insert violates this index rather than creating a
-- second competing revision.
CREATE UNIQUE INDEX "submissions_revision_of_id_key" ON "submissions"("revision_of_id");

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_revision_of_id_fkey"
  FOREIGN KEY ("revision_of_id") REFERENCES "submissions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A submission can never be its own revision. Combined with the unique index
-- above, the service rule that only an AWAITING_REVISION submission may be
-- revised, and the fact that `revision_of_id` is written once at creation and
-- never updated, this makes a lineage cycle unrepresentable.
ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_revision_not_self"
  CHECK ("revision_of_id" IS NULL OR "revision_of_id" <> "id");
