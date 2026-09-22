import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AutomationScopeType, AutomationStatus } from '@prisma/client';
import { TriggerDto } from './trigger.dto';
import { ActionDto } from './action.dto';

export class CreateAutomationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  // Ownership is verified server-side against the caller's workspace in
  // AutomationsService — CLAUDE.md §5a A01, never trust this ID alone.
  @IsString()
  instagramAccountId!: string;

  @IsOptional()
  @IsEnum(AutomationStatus)
  status?: AutomationStatus;

  @IsOptional()
  @IsEnum(AutomationScopeType)
  scopeType?: AutomationScopeType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopeMediaIds?: string[];

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TriggerDto)
  triggers!: TriggerDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions!: ActionDto[];
}
