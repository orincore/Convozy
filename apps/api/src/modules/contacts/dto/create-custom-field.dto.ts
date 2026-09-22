import { IsEnum, IsString, Matches, MinLength } from 'class-validator';
import { CustomFieldType } from '@prisma/client';

export class CreateCustomFieldDto {
  // Machine key used in segment rules/field-value lookups — kept restrictive
  // (snake_case-ish) so it's safe to use as a stable identifier without
  // further sanitization anywhere it's referenced.
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores',
  })
  key!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsEnum(CustomFieldType)
  type!: CustomFieldType;
}
