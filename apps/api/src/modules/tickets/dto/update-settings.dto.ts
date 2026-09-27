import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTicketSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];

  @IsOptional() @IsBoolean() createFromMentions?: boolean;
  @IsOptional() @IsBoolean() createFromAllDms?: boolean;
  @IsOptional() @IsBoolean() createFromStoryMentions?: boolean;
  @IsOptional() @IsBoolean() createFromReferrals?: boolean;
  @IsOptional() @IsBoolean() createFromTaggedPosts?: boolean;
  @IsOptional() @IsBoolean() autoAssignEnabled?: boolean;
}
