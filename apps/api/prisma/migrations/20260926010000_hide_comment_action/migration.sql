-- Milestone 4 (Comment Moderation): adds HIDE_COMMENT as a real action type,
-- so an automation can auto-hide a comment on match (POST /<COMMENT_ID>?hide=true).
-- Additive only — every existing Action row's type is unaffected.
ALTER TYPE "ActionType" ADD VALUE 'HIDE_COMMENT';
