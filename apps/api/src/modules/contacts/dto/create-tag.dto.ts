import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;
}
