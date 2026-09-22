import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ConditionField, TriggerMatchType } from '@prisma/client';

// Mirrors TriggerDto's shape deliberately (CLAUDE.md §14: branching supports
// every match type a trigger does, including the AI_INTENT stub, not a
// simplified subset).
export class ConditionDto {
  @IsEnum(TriggerMatchType)
  matchType!: TriggerMatchType;

  @IsOptional()
  @IsEnum(ConditionField)
  field?: ConditionField;

  // EXACT/CONTAINS: any-match against these keywords, or — if left empty —
  // always evaluates true (unconditional branch). REGEX: first entry is
  // the pattern, required. Ignored for AI_INTENT.
  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean;

  @IsOptional()
  @IsString()
  aiIntentLabel?: string;
}
