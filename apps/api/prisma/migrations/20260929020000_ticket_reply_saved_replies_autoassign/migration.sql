-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "profilePictureUrl" TEXT;

-- AlterTable
ALTER TABLE "TicketParticipant" ADD COLUMN     "profilePictureUrl" TEXT;

-- AlterTable
ALTER TABLE "TicketSettings" ADD COLUMN     "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN     "replyToMessageId" TEXT;

-- CreateTable
CREATE TABLE "SavedReply" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedReply_workspaceId_idx" ON "SavedReply"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedReply_workspaceId_title_key" ON "SavedReply"("workspaceId", "title");

-- AddForeignKey
ALTER TABLE "SavedReply" ADD CONSTRAINT "SavedReply_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_replyToMessageId_fkey" FOREIGN KEY ("replyToMessageId") REFERENCES "TicketMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
