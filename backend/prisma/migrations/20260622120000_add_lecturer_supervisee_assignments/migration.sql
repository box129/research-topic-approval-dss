-- CreateTable
CREATE TABLE "lecturer_supervisee_assignments" (
    "id" SERIAL NOT NULL,
    "lecturer_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "assigned_by_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecturer_supervisee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lecturer_supervisee_assignments_lecturer_id_is_active_idx" ON "lecturer_supervisee_assignments"("lecturer_id", "is_active");

-- CreateIndex
CREATE INDEX "lecturer_supervisee_assignments_student_id_is_active_idx" ON "lecturer_supervisee_assignments"("student_id", "is_active");

-- CreateIndex
CREATE INDEX "lecturer_supervisee_assignments_assigned_by_id_idx" ON "lecturer_supervisee_assignments"("assigned_by_id");

-- CreateIndex
CREATE INDEX "lecturer_supervisee_assignments_assigned_at_idx" ON "lecturer_supervisee_assignments"("assigned_at");

-- CreateIndex
CREATE UNIQUE INDEX "lecturer_supervisee_assignments_active_pair_unique" ON "lecturer_supervisee_assignments"("lecturer_id", "student_id") WHERE "is_active" = true;

-- AddForeignKey
ALTER TABLE "lecturer_supervisee_assignments" ADD CONSTRAINT "lecturer_supervisee_assignments_lecturer_id_fkey" FOREIGN KEY ("lecturer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_supervisee_assignments" ADD CONSTRAINT "lecturer_supervisee_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecturer_supervisee_assignments" ADD CONSTRAINT "lecturer_supervisee_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
