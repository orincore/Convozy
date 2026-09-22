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

  // Required for EXACT/CONTAINS (one or more keywords, any-match) and REGEX
  // (first entry is the pattern). Ignored for AI_INTENT.
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
