-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "decided_at" TIMESTAMP(3),
ADD COLUMN     "decided_by_id" INTEGER,
ADD COLUMN     "decision_reason" TEXT;

-- CreateIndex
CREATE INDEX "submissions_decided_by_id_idx" ON "submissions"("decided_by_id");

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
