-- Condition/branching step in the automation engine (MANYCHAT_FEATURE_AUDIT.md
-- §4 "Condition / branching step" — the biggest functional gap vs. ManyChat's
-- Flow Builder; everything else in the roadmap (require-follow-gate, sequence
-- entry conditions) builds on this existing first).
ALTER TYPE "ActionType" ADD VALUE 'CONDITION';

-- CreateEnum
CREATE TYPE "ActionBranch" AS ENUM ('THEN', 'ELSE');

-- CreateEnum
CREATE TYPE "ConditionField" AS ENUM ('COMMENT_TEXT', 'SENDER_USERNAME');

-- A CONDITION action has no message payload of its own.
ALTER TABLE "Action" ALTER COLUMN "payload" DROP NOT NULL;

-- Branching tree: root-level actions keep parentActionId = null and
-- branch = null (fully backwards compatible with every existing automation).
ALTER TABLE "Action" ADD COLUMN     "parentActionId" TEXT;
ALTER TABLE "Action" ADD COLUMN     "branch" "ActionBranch";

-- CreateTable
CREATE TABLE "Condition" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "matchType" "TriggerMatchType" NOT NULL,
    "field" "ConditionField" NOT NULL DEFAULT 'COMMENT_TEXT',
    "keywords" TEXT[],
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "aiIntentLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Condition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Condition_actionId_key" ON "Condition"("actionId");

-- CreateIndex
CREATE INDEX "Action_parentActionId_idx" ON "Action"("parentActionId");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_parentActionId_fkey" FOREIGN KEY ("parentActionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;
