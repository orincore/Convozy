import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const FEED_LIMIT = 50;

/**
 * Read-only aggregation across CommentEvent/InstagramAccount/Automation/
 * MessageLog for the dashboard's activity feed — this is a slice of the
 * `analytics` module ARCHITECTURE.md §3 describes ("aggregates from
 * MessageLog/CommentEvent"), pulled forward since Phase 4 needs a real feed
 * now rather than the full Phase 8 analytics module. Reads across those
 * models directly (rather than round-tripping through each owning module's
 * service) is what that module is for — CLAUDE.md §3's "no cross-module
 * writes" rule, not a ban on read aggregation.
 */
@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async listRecentEvents(workspaceId: string) {
    return this.prisma.commentEvent.findMany({
      where: { workspaceId },
      orderBy: { receivedAt: 'desc' },
      take: FEED_LIMIT,
      select: {
        id: true,
        source: true,
        fromUsername: true,
        text: true,
        status: true,
        receivedAt: true,
        processedAt: true,
        instagramAccount: { select: { id: true, igUsername: true } },
        matchedAutomation: { select: { id: true, name: true } },
        messageLogs: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, actionType: true, status: true, errorCode: true, createdAt: true, sentAt: true },
        },
      },
    });
  }
}
