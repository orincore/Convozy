import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { TriggerMatchType, TriggerSource } from '@prisma/client';

export class TriggerDto {
  @IsEnum(TriggerSource)
  source!: TriggerSource;

  @IsEnum(TriggerMatchType)
  matchType!: TriggerMatchType;

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
