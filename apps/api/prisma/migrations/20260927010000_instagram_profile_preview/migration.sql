-- Cached Instagram profile preview fields (display name, profile picture,
-- follower count) so the dashboard never needs to ping the Graph API live
-- just to render the Accounts page. All nullable/additive — existing rows
-- backfill on their next connect or token-refresh cycle.
ALTER TABLE "InstagramAccount"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "profilePictureUrl" TEXT,
  ADD COLUMN "followersCount" INTEGER,
  ADD COLUMN "profileSyncedAt" TIMESTAMP(3);
