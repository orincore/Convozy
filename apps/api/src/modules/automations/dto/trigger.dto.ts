import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { TriggerMatchType, TriggerSource } from '@prisma/client';

export class TriggerDto {
  @IsEnum(TriggerSource)
  source!: TriggerSource;

  @IsEnum(TriggerMatchType)
  matchType!: TriggerMatchType;

  // EXACT/CONTAINS: any-match against these keywords, or — if left empty —
  // matches unconditionally (every comment on the post). REGEX: first entry
  // is the pattern, required (rejected at write time if missing/invalid, no
  // "match anything" fallback makes sense there). Ignored for AI_INTENT.
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
