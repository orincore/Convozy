import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

// eq/neq/contains only, deliberately — a genuine scoping decision, not a
// silent gap (CLAUDE.md §14). ContactFieldValue.value is stored as text
// regardless of the field's declared type, so a numeric gt/lt comparison
// would either need a typed value column or raw SQL with type-aware casting
// — real scope beyond what segmentation's first pass needs. eq/neq/contains
// cover tags-as-fields, booleans (eq 'true'/'false'), and substring search,
// which is the large majority of real segmentation use cases.
export enum SegmentRuleOp {
  EQ = 'eq',
  NEQ = 'neq',
  CONTAINS = 'contains',
}

export class SegmentFieldRuleDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsEnum(SegmentRuleOp)
  op!: SegmentRuleOp;

  @IsString()
  value!: string;
}

// A segment rule tree node — exactly one of all/any/tag/field, enforced at
// write time in SegmentsService (not expressible as a class-validator union,
// same reasoning as ActionDto's CONDITION-only fields). Recursive: `all`/
// `any` contain further SegmentRuleDto nodes, bounded at
// MAX_SEGMENT_RULE_DEPTH in the service.
export class SegmentRuleDto {
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  all?: SegmentRuleDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SegmentRuleDto)
  any?: SegmentRuleDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  tag?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SegmentFieldRuleDto)
  field?: SegmentFieldRuleDto;
}
