-- Structured-context-v1 semantic fields on student submissions.
--
-- The frozen production contract embeds a submitted topic from the same
-- canonical text as a direct similarity check: title plus any supplied
-- population, location and study focus. Submissions previously persisted only
-- the title, so supplied context was lost before embedding and the submission
-- lifecycle diverged from the calibrated representation.
--
-- Additive only. Existing rows keep NULLs and remain valid: a NULL means the
-- field is genuinely absent, so those submissions serialise title-only exactly
-- as they always did. No existing migration is edited.

ALTER TABLE "submissions" ADD COLUMN "population" TEXT;
ALTER TABLE "submissions" ADD COLUMN "location" TEXT;
ALTER TABLE "submissions" ADD COLUMN "study_focus" TEXT;
