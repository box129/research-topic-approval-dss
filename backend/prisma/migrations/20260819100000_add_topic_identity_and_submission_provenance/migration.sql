-- Additive migration: import idempotency fingerprints and submission provenance
-- for the semantic topic repositories. No existing data is modified or dropped.

-- AlterTable
ALTER TABLE "historical_topics" ADD COLUMN "source_fingerprint" TEXT;

-- AlterTable
ALTER TABLE "current_session_topics" ADD COLUMN "source_fingerprint" TEXT,
ADD COLUMN "submission_id" INTEGER;

-- AlterTable
ALTER TABLE "under_review_topics" ADD COLUMN "source_fingerprint" TEXT,
ADD COLUMN "submission_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "historical_topics_source_fingerprint_key" ON "historical_topics"("source_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "current_session_topics_source_fingerprint_key" ON "current_session_topics"("source_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "current_session_topics_submission_id_key" ON "current_session_topics"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "under_review_topics_source_fingerprint_key" ON "under_review_topics"("source_fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "under_review_topics_submission_id_key" ON "under_review_topics"("submission_id");

-- AddForeignKey
ALTER TABLE "current_session_topics" ADD CONSTRAINT "current_session_topics_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "under_review_topics" ADD CONSTRAINT "under_review_topics_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
