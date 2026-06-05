-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "actor_id" INTEGER,
    "actor_role" VARCHAR(50),
    "actor_email" VARCHAR(200),
    "target_type" VARCHAR(100),
    "target_id" VARCHAR(100),
    "request_id" VARCHAR(100),
    "ip_address" VARCHAR(100),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_role_idx" ON "audit_logs"("actor_role");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
