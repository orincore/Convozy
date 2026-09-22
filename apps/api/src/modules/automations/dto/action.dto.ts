import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf, ValidateNested } from 'class-validator';
import { ActionType } from '@prisma/client';
import { ConditionDto } from './condition.dto';

// A generic link button on a DM (Meta's generic/button message template).
// Kept minimal on purpose — ARCHITECTURE.md §4 describes the Action payload
// as "text/template, buttons/links", nothing richer than this yet.
export class ActionButtonDto {
  @IsString()
  title!: string;

  @IsString()
  url!: string;
}

export class ActionPayloadDto {
  // Supports the `{{username}}` placeholder, substituted with the
  // commenter's IG username at send time — see AutomationsService.renderText.
  @IsString()
  text!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionButtonDto)
  buttons?: ActionButtonDto[];
}

// The THEN/ELSE branches of a CONDITION action. Recursive: each branch is
// itself a list of ActionDto, so a CONDITION can nest further CONDITIONs
// (bounded at write time by AutomationsService.MAX_ACTION_TREE_DEPTH, not
// here — DTO validation recurses however deep the input actually is).
export class ActionChildrenDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  then!: ActionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionDto)
  else!: ActionDto[];
}

export class ActionDto {
  @IsEnum(ActionType)
  type!: ActionType;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  delaySeconds?: number;

  // Required for every action type except CONDITION, which has no message
  // payload of its own.
  @ValidateIf((o: ActionDto) => o.type !== ActionType.CONDITION)
  @ValidateNested()
  @Type(() => ActionPayloadDto)
  payload?: ActionPayloadDto;

  // Required only for CONDITION actions.
  @ValidateIf((o: ActionDto) => o.type === ActionType.CONDITION)
  @ValidateNested()
  @Type(() => ConditionDto)
  condition?: ConditionDto;

  @ValidateIf((o: ActionDto) => o.type === ActionType.CONDITION)
  @ValidateNested()
  @Type(() => ActionChildrenDto)
  children?: ActionChildrenDto;
}
