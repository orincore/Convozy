jest.mock('@nestjs/common', () => ({ Injectable: () => () => {} }));

import { ActivityService } from './activity.service';

describe('ActivityService.listRecentEvents', () => {
  it('scopes the query to the caller workspace and orders newest first', async () => {
    const prisma = { commentEvent: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new ActivityService(prisma);

    await service.listRecentEvents('workspace-1');

    expect(prisma.commentEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'workspace-1' },
        orderBy: { receivedAt: 'desc' },
      }),
    );
  });

  it('never lets a caller pass a workspaceId other than their own', async () => {
    // The service takes workspaceId as a plain parameter, not from any
    // client-supplied field — the controller sources it from the
    // authenticated RequestUser only (CLAUDE.md §5a A01). This test just
    // documents that the where-clause is the sole source of scoping.
    const prisma = { commentEvent: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    const service = new ActivityService(prisma);

    await service.listRecentEvents('workspace-a');
    await service.listRecentEvents('workspace-b');

    expect(prisma.commentEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { workspaceId: 'workspace-a' } }),
    );
    expect(prisma.commentEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { workspaceId: 'workspace-b' } }),
    );
  });
});
