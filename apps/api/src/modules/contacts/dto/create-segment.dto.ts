import { Type } from 'class-transformer';
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { SegmentRuleDto } from './segment-rule.dto';

export class CreateSegmentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @ValidateNested()
  @Type(() => SegmentRuleDto)
  rules!: SegmentRuleDto;
}

export class UpdateSegmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentRuleDto)
  rules?: SegmentRuleDto;
}
