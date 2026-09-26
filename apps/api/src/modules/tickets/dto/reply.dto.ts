import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class ReplyDto {
  @IsString()
  participantId!: string;

  // DM = a direct message (or the one private reply to a comment when no DM
  // window is open); PUBLIC_REPLY = a public reply under their comment.
  @IsIn(['DM', 'PUBLIC_REPLY'])
  channel!: 'DM' | 'PUBLIC_REPLY';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text!: string;
}

export class NoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
