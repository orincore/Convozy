import { IsEmail, IsIn } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  // Owners can't be invited: there is exactly one, the workspace creator.
  @IsIn(['ADMIN', 'MEMBER'])
  role!: 'ADMIN' | 'MEMBER';
}
