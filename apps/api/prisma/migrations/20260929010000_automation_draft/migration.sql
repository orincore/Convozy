-- Automation drafts: the builder's in-progress state, kept while status = DRAFT.
-- Additive and nullable, existing rows are unaffected.
ALTER TABLE "Automation" ADD COLUMN "draft" JSONB;
