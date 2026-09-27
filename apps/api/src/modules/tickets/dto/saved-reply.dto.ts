import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSavedReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class UpdateSavedReplyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text?: string;
}
