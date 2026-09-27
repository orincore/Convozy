import 'reflect-metadata';

jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    constructor(
      public response: unknown,
      public status: number,
    ) {
      super(typeof response === 'string' ? response : JSON.stringify(response));
    }
  }
  return { Injectable: () => () => {}, HttpException, HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409 } };
});

import { Prisma } from '@prisma/client';
import { SavedRepliesService } from './saved-replies.service';
import { ConflictAppException, NotFoundAppException } from '../../common/utils/app-exception';

function makeService() {
  const prisma = {
    savedReply: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'reply-1', ...data })),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  } as any;
  return { service: new SavedRepliesService(prisma), prisma };
}

function duplicateTitleError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.22.0' });
}

describe('SavedRepliesService', () => {
  it('lists a workspace\'s saved replies alphabetically by title', async () => {
    const { service, prisma } = makeService();
    await service.list('ws-1');
    expect(prisma.savedReply.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'ws-1' }, orderBy: { title: 'asc' } });
  });

  it('creates a saved reply, trimming title and text', async () => {
    const { service, prisma } = makeService();
    const result = await service.create('ws-1', { title: '  Apology  ', text: '  Hey {{username}}, sorry!  ' });
    expect(prisma.savedReply.create).toHaveBeenCalledWith({ data: { workspaceId: 'ws-1', title: 'Apology', text: 'Hey {{username}}, sorry!' } });
    expect(result.id).toBe('reply-1');
  });

  it('rejects a duplicate title within the same workspace', async () => {
    const { service, prisma } = makeService();
    prisma.savedReply.create.mockRejectedValue(duplicateTitleError());
    await expect(service.create('ws-1', { title: 'Apology', text: 'x' })).rejects.toThrow(ConflictAppException);
  });

  it('404s updating a saved reply that does not exist (or belongs to another workspace)', async () => {
    const { service } = makeService();
    await expect(service.update('ws-1', 'missing', { title: 'x' })).rejects.toThrow(NotFoundAppException);
  });

  it('updates only the fields provided', async () => {
    const { service, prisma } = makeService();
    prisma.savedReply.findFirst.mockResolvedValue({ id: 'reply-1', workspaceId: 'ws-1', title: 'Apology', text: 'old' });

    await service.update('ws-1', 'reply-1', { text: 'new text' });

    expect(prisma.savedReply.update).toHaveBeenCalledWith({ where: { id: 'reply-1' }, data: { title: undefined, text: 'new text' } });
  });

  it('404s deleting a saved reply from another workspace', async () => {
    const { service } = makeService();
    await expect(service.remove('ws-1', 'missing')).rejects.toThrow(NotFoundAppException);
  });

  it('deletes an owned saved reply', async () => {
    const { service, prisma } = makeService();
    prisma.savedReply.findFirst.mockResolvedValue({ id: 'reply-1', workspaceId: 'ws-1' });

    await service.remove('ws-1', 'reply-1');

    expect(prisma.savedReply.delete).toHaveBeenCalledWith({ where: { id: 'reply-1' } });
  });
});
