import { TicketPriority, TicketSource, TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListTicketsQueryDto {
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  // active (default) = not resolved/closed; closed = resolved or closed; all = everything.
  @IsOptional() @IsIn(['active', 'closed', 'all']) view?: 'active' | 'closed' | 'all';
  @IsOptional() @IsEnum(TicketPriority) priority?: TicketPriority;
  @IsOptional() @IsEnum(TicketSource) source?: TicketSource;
  // 'me' | 'unassigned' | a user id
  @IsOptional() @IsString() assignee?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
