import { IsString } from 'class-validator';

// The raw string value — validated against the target CustomField's declared
// type (NUMBER/BOOLEAN/DATE/TEXT) in ContactsService.setFieldValue, since
// that requires looking up the field's type first. See CustomFieldType.
export class SetFieldValueDto {
  @IsString()
  value!: string;
}
