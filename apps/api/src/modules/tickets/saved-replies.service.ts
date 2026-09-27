import { Injectable } from '@nestjs/common';
import { Prisma, SavedReply } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictAppException, NotFoundAppException } from '../../common/utils/app-exception';
import { CreateSavedReplyDto, UpdateSavedReplyDto } from './dto/saved-reply.dto';

/**
 * Canned responses agents can drop into the ticket composer — supports the
 * same merge tags as automations ({{username}}, {{full_name}},
 * {{field.<key>}}), rendered by TicketsService.reply via MergeTagsService at
 * send time, not here (this service only owns the template CRUD).
 */
@Injectable()
export class SavedRepliesService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string): Promise<SavedReply[]> {
    return this.prisma.savedReply.findMany({ where: { workspaceId }, orderBy: { title: 'asc' } });
  }

  async create(workspaceId: string, dto: CreateSavedReplyDto): Promise<SavedReply> {
    try {
      return await this.prisma.savedReply.create({
        data: { workspaceId, title: dto.title.trim(), text: dto.text.trim() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictAppException('SAVED_REPLY_TITLE_TAKEN', 'A saved reply with this title already exists.');
      }
      throw err;
    }
  }

  async update(workspaceId: string, id: string, dto: UpdateSavedReplyDto): Promise<SavedReply> {
    await this.getOwned(workspaceId, id);
    try {
      return await this.prisma.savedReply.update({
        where: { id },
        data: { title: dto.title?.trim(), text: dto.text?.trim() },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictAppException('SAVED_REPLY_TITLE_TAKEN', 'A saved reply with this title already exists.');
      }
      throw err;
    }
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    await this.getOwned(workspaceId, id);
    await this.prisma.savedReply.delete({ where: { id } });
  }

  private async getOwned(workspaceId: string, id: string): Promise<SavedReply> {
    const savedReply = await this.prisma.savedReply.findFirst({ where: { id, workspaceId } });
    if (!savedReply) {
      throw new NotFoundAppException('SAVED_REPLY_NOT_FOUND', 'Saved reply not found.');
    }
    return savedReply;
  }
}
