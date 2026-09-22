-- Instagram Login's /me returns an app-scoped `id` (stored as igBusinessId,
-- used for outbound Graph API calls) that is NOT the same ID Meta puts in
-- webhook payloads' entry.id — that's the separate `user_id` field. Every
-- webhook was failing to match any connected account because we only ever
-- stored the app-scoped id. See instagram.service.ts and webhooks.controller.ts.
-- Nullable: existing accounts won't have this until they reconnect.
ALTER TABLE "InstagramAccount" ADD COLUMN     "igUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "InstagramAccount_igUserId_key" ON "InstagramAccount"("igUserId");
