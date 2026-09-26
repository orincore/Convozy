import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  // Ownership is verified server-side against the caller's workspace.
  @IsString()
  instagramAccountId!: string;

  // The builder's own state. Opaque to the server; size-capped in the service.
  @IsObject()
  data!: Record<string, unknown>;
}

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsObject()
  data!: Record<string, unknown>;
}
