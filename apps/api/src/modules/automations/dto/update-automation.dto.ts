import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { AutomationScopeType, AutomationStatus } from '@prisma/client';
import { TriggerDto } from './trigger.dto';
import { ActionDto } from './action.dto';

// Deliberately not `PartialType(CreateAutomationDto)`: instagramAccountId is
// intentionally excluded (an automation doesn't move between accounts —
// disconnect and recreate instead), and triggers/actions, when present, are
// a full replace rather than a merge (see AutomationsService.update) to
// avoid diffing complexity ahead of when the dashboard builder actually
// needs it (Phase 4).
export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

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

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TriggerDto)
  triggers?: TriggerDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  actions?: ActionDto[];
}
