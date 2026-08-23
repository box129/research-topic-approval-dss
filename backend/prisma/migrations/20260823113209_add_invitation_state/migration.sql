-- Account invitation state (additive only).
--
-- Adds the email-invitation lifecycle to users: SHA-256 hash of the one-time
-- invitation token (plaintext is never stored), its expiry, delivery
-- bookkeeping timestamps, a short safe delivery-error code, and the
-- acceptance timestamp. All columns are nullable, so existing accounts are
-- preserved unchanged and remain fully functional without invitations.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "invitation_accepted_at" TIMESTAMP(3),
ADD COLUMN     "invitation_expires_at" TIMESTAMP(3),
ADD COLUMN     "invitation_last_attempt_at" TIMESTAMP(3),
ADD COLUMN     "invitation_last_error" VARCHAR(100),
ADD COLUMN     "invitation_last_sent_at" TIMESTAMP(3),
ADD COLUMN     "invitation_token_hash" TEXT;

-- CreateIndex
CREATE INDEX "users_invitation_token_hash_idx" ON "users"("invitation_token_hash");
