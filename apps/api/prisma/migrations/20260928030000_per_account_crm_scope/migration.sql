-- Multi-account: tags, custom fields, segments and ticket rules now belong to one
-- Instagram account instead of the whole workspace, so each connected account
-- keeps a fully separate CRM. Existing rows are assigned to their workspace's
-- first-connected account (workspaces with no account keep NULL and are unused).
-- Contacts, automations, events and tickets already carried instagramAccountId.

-- DropIndex
DROP INDEX "Tag_workspaceId_name_key";

-- DropIndex
DROP INDEX "CustomField_workspaceId_key_key";

-- DropIndex
DROP INDEX "Segment_workspaceId_name_key";

-- DropIndex
DROP INDEX "TicketSettings_workspaceId_key";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "instagramAccountId" TEXT;

-- AlterTable
ALTER TABLE "CustomField" ADD COLUMN     "instagramAccountId" TEXT;

-- AlterTable
ALTER TABLE "Segment" ADD COLUMN     "instagramAccountId" TEXT;

-- AlterTable
ALTER TABLE "TicketSettings" ADD COLUMN     "instagramAccountId" TEXT;

-- Backfill existing rows to the workspace's first-connected account
UPDATE "Tag" x SET "instagramAccountId" = (
  SELECT a."id" FROM "InstagramAccount" a WHERE a."workspaceId" = x."workspaceId" ORDER BY a."connectedAt" ASC LIMIT 1
) WHERE x."instagramAccountId" IS NULL;

UPDATE "CustomField" x SET "instagramAccountId" = (
  SELECT a."id" FROM "InstagramAccount" a WHERE a."workspaceId" = x."workspaceId" ORDER BY a."connectedAt" ASC LIMIT 1
) WHERE x."instagramAccountId" IS NULL;

UPDATE "Segment" x SET "instagramAccountId" = (
  SELECT a."id" FROM "InstagramAccount" a WHERE a."workspaceId" = x."workspaceId" ORDER BY a."connectedAt" ASC LIMIT 1
) WHERE x."instagramAccountId" IS NULL;

UPDATE "TicketSettings" x SET "instagramAccountId" = (
  SELECT a."id" FROM "InstagramAccount" a WHERE a."workspaceId" = x."workspaceId" ORDER BY a."connectedAt" ASC LIMIT 1
) WHERE x."instagramAccountId" IS NULL;

-- CreateIndex
CREATE INDEX "Tag_workspaceId_idx" ON "Tag"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_instagramAccountId_name_key" ON "Tag"("instagramAccountId", "name");

-- CreateIndex
CREATE INDEX "CustomField_workspaceId_idx" ON "CustomField"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomField_instagramAccountId_key_key" ON "CustomField"("instagramAccountId", "key");

-- CreateIndex
CREATE INDEX "Segment_workspaceId_idx" ON "Segment"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_instagramAccountId_name_key" ON "Segment"("instagramAccountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TicketSettings_instagramAccountId_key" ON "TicketSettings"("instagramAccountId");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomField" ADD CONSTRAINT "CustomField_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketSettings" ADD CONSTRAINT "TicketSettings_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "InstagramAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

