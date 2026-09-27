import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  // Quote-reply to one specific earlier message in this ticket's thread
  // (Meta's Send API reply_to.mid — inbound or outbound, DM channel only;
  // see MessagingService.callGraphApi). The id of a TicketMessage on this
  // same ticket, not the raw Meta mid — resolved and validated server-side.
  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}

export class NoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
}
