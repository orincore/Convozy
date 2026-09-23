import { IsString, MinLength } from 'class-validator';

export class InstallTemplateDto {
  // Ownership is verified server-side against the caller's workspace in
  // AutomationsService.create — CLAUDE.md §5a A01, never trust this ID alone.
  @IsString()
  @MinLength(1)
  instagramAccountId!: string;
}
