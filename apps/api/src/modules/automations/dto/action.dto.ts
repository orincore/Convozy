import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ActionType } from '@prisma/client';
import { ConditionDto } from './condition.dto';

// A button on a DM (Meta's Button Template — messaging-api/button-template).
// WEB_URL opens a link, unchanged from before. POSTBACK is new: tapping it
// fires a messaging_postbacks webhook Convozy resolves back to this exact
// button (see AutomationsService.createActionTree/resolvePostback) and
// replies with `unlockedText`, or `lockedText` if `requireFollow` is set and
// the tapper isn't following (InstagramService.checkIsFollowing). `payload`
// is never trusted from the client — the server always assigns it as
// `${actionId}:${buttonIndex}` once the action row exists, so a postback can
// never be forged to resolve to another workspace's action.
export class ActionButtonDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsIn(['WEB_URL', 'POSTBACK'])
  type!: 'WEB_URL' | 'POSTBACK';

  @ValidateIf((o: ActionButtonDto) => o.type === 'WEB_URL')
  @IsString()
  @MinLength(1)
  url?: string;

  @ValidateIf((o: ActionButtonDto) => o.type === 'POSTBACK')
  @IsBoolean()
  requireFollow?: boolean;

  // The message sent back when tapped and either not gated, or gated and
  // the tapper is following.
  @ValidateIf((o: ActionButtonDto) => o.type === 'POSTBACK')
  @IsString()
  @MinLength(1)
  unlockedText?: string;

  // The message sent back when tapped, gated (requireFollow), and the
  // tapper is not (or not verifiably) following — fails closed, see
  // InstagramService.checkIsFollowing.
  @ValidateIf((o: ActionButtonDto) => o.type === 'POSTBACK' && o.requireFollow === true)
  @IsString()
  @MinLength(1)
  lockedText?: string;
}

export class ActionPayloadDto {
  // Supports the `{{username}}` placeholder, substituted with the
  // commenter's IG username at send time — see AutomationsService.renderText.
  @IsString()
  text!: string;

  // Meta's Button Template caps a message at 3 buttons.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
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

  // Required for every action type except CONDITION and HIDE_COMMENT, which
  // carry no message payload of their own.
  @ValidateIf((o: ActionDto) => o.type !== ActionType.CONDITION && o.type !== ActionType.HIDE_COMMENT)
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
