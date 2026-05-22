-- CreateTable
CREATE TABLE "similarity_check_snapshots" (
    "id" SERIAL NOT NULL,
    "submission_id" INTEGER NOT NULL,
    "checked_by_id" INTEGER NOT NULL,
    "response_status" VARCHAR(50) NOT NULL,
    "overall_risk" VARCHAR(50),
    "max_similarity" DOUBLE PRECISION,
    "recommendation" TEXT,
    "result_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "similarity_check_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "similarity_check_snapshots_submission_id_idx" ON "similarity_check_snapshots"("submission_id");

-- CreateIndex
CREATE INDEX "similarity_check_snapshots_checked_by_id_idx" ON "similarity_check_snapshots"("checked_by_id");

-- CreateIndex
CREATE INDEX "similarity_check_snapshots_created_at_idx" ON "similarity_check_snapshots"("created_at");

-- AddForeignKey
ALTER TABLE "similarity_check_snapshots" ADD CONSTRAINT "similarity_check_snapshots_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "similarity_check_snapshots" ADD CONSTRAINT "similarity_check_snapshots_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
