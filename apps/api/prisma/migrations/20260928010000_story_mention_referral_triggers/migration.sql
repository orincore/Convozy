-- Adds two conversation-sourced trigger sources: someone mentioning the
-- account in their story (messages webhook, story_mention attachment) and
-- someone opening a chat via an ig.me link / ad (messaging_referral).
-- Additive only, existing rows unaffected. Separate statements because
-- Postgres can't use a new enum value in the transaction that adds it.
ALTER TYPE "TriggerSource" ADD VALUE 'STORY_MENTION';
ALTER TYPE "TriggerSource" ADD VALUE 'REFERRAL';
