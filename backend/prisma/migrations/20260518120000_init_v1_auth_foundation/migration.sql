-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'LECTURER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "reset_token_hash" TEXT,
    "reset_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_sessions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "historical_topics" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT,
    "session_year" TEXT NOT NULL,
    "supervisor_name" TEXT NOT NULL,
    "category" TEXT,
    "population" TEXT,
    "location" TEXT,
    "study_focus" TEXT,
    "raw_record" JSONB,
    "import_warnings" JSONB,
    "source_type" TEXT,
    "source_filename" TEXT,
    "import_batch_id" TEXT,
    "embedding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "historical_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "current_session_topics" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT,
    "session_year" TEXT NOT NULL,
    "supervisor_name" TEXT NOT NULL,
    "category" TEXT,
    "population" TEXT,
    "location" TEXT,
    "study_focus" TEXT,
    "raw_record" JSONB,
    "import_warnings" JSONB,
    "source_type" TEXT,
    "source_filename" TEXT,
    "import_batch_id" TEXT,
    "embedding" JSONB,
    "approved_date" TIMESTAMP(3),
    "student_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "current_session_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "under_review_topics" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "keywords" TEXT,
    "session_year" TEXT NOT NULL,
    "supervisor_name" TEXT NOT NULL,
    "category" TEXT,
    "population" TEXT,
    "location" TEXT,
    "study_focus" TEXT,
    "raw_record" JSONB,
    "import_warnings" JSONB,
    "source_type" TEXT,
    "source_filename" TEXT,
    "import_batch_id" TEXT,
    "embedding" JSONB,
    "review_started_at" TIMESTAMP(3),
    "reviewing_lecturer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "under_review_topics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "academic_sessions_name_key" ON "academic_sessions"("name");

-- CreateIndex
CREATE INDEX "academic_sessions_is_current_idx" ON "academic_sessions"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "categories_is_active_idx" ON "categories"("is_active");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE INDEX "historical_topics_category_idx" ON "historical_topics"("category");

-- CreateIndex
CREATE INDEX "historical_topics_session_year_idx" ON "historical_topics"("session_year");

-- CreateIndex
CREATE INDEX "historical_topics_created_at_idx" ON "historical_topics"("created_at");

-- CreateIndex
CREATE INDEX "historical_topics_import_batch_id_idx" ON "historical_topics"("import_batch_id");

-- CreateIndex
CREATE INDEX "current_session_topics_category_idx" ON "current_session_topics"("category");

-- CreateIndex
CREATE INDEX "current_session_topics_session_year_idx" ON "current_session_topics"("session_year");

-- CreateIndex
CREATE INDEX "current_session_topics_created_at_idx" ON "current_session_topics"("created_at");

-- CreateIndex
CREATE INDEX "current_session_topics_import_batch_id_idx" ON "current_session_topics"("import_batch_id");

-- CreateIndex
CREATE INDEX "under_review_topics_category_idx" ON "under_review_topics"("category");

-- CreateIndex
CREATE INDEX "under_review_topics_session_year_idx" ON "under_review_topics"("session_year");

-- CreateIndex
CREATE INDEX "under_review_topics_created_at_idx" ON "under_review_topics"("created_at");

-- CreateIndex
CREATE INDEX "under_review_topics_review_started_at_idx" ON "under_review_topics"("review_started_at");

-- CreateIndex
CREATE INDEX "under_review_topics_import_batch_id_idx" ON "under_review_topics"("import_batch_id");

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
