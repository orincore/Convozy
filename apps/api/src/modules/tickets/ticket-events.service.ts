import { Inject, Injectable, Logger, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import Redis from 'ioredis';
import { Observable } from 'rxjs';
import { REDIS_CLIENT } from '../../redis/redis.module';

const CHANNEL = 'convozy:tickets:events';
const PING_INTERVAL_MS = 20_000;

export interface TicketLiveEvent {
  workspaceId: string;
  instagramAccountId: string;
  ticketId: string;
  // What changed, so the page can decide what to refresh.
  reason: 'created' | 'message' | 'updated' | 'reply' | 'note';
}

/**
 * Live ticket updates. The worker (which receives webhooks) and the API (which
 * agents act through) are separate processes, so changes are published on a Redis
 * channel and every API process forwards them to the browsers connected to its
 * SSE stream. Events carry ids only, never message content: the page refetches
 * through the normal authorised endpoints.
 */
@Injectable()
export class TicketEventsService implements OnModuleDestroy {
  private readonly logger = new Logger(TicketEventsService.name);
  private readonly emitter = new EventEmitter();
  private subscriber: Redis | null = null;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    this.emitter.setMaxListeners(0);
  }

  async publish(event: TicketLiveEvent): Promise<void> {
    try {
      await this.redis.publish(CHANNEL, JSON.stringify(event));
    } catch (err) {
      // Live updates are a convenience: never fail the action that caused them.
      this.logger.warn(`Could not publish ticket event: ${(err as Error).message}`);
    }
  }

  /** Events for one workspace and Instagram account, plus a periodic ping that keeps proxies from closing the stream. */
  stream(workspaceId: string, instagramAccountId: string): Observable<MessageEvent> {
    this.ensureSubscribed();
    return new Observable<MessageEvent>((subscriber) => {
      const onEvent = (event: TicketLiveEvent) => {
        if (event.workspaceId === workspaceId && event.instagramAccountId === instagramAccountId) {
          subscriber.next({ data: { type: 'ticket', ticketId: event.ticketId, reason: event.reason } });
        }
      };
      this.emitter.on('event', onEvent);
      subscriber.next({ data: { type: 'ready' } });
      const ping = setInterval(() => subscriber.next({ data: { type: 'ping' } }), PING_INTERVAL_MS);
      return () => {
        this.emitter.off('event', onEvent);
        clearInterval(ping);
      };
    });
  }

  private ensureSubscribed(): void {
    if (this.subscriber) return;
    // A connection in subscribe mode can't run other commands, so it gets its own.
    const subscriber = this.redis.duplicate();
    this.subscriber = subscriber;
    subscriber.on('error', (err) => this.logger.warn(`Ticket events subscriber error: ${err.message}`));
    subscriber.subscribe(CHANNEL).catch((err: Error) => this.logger.error(`Could not subscribe to ticket events: ${err.message}`));
    subscriber.on('message', (_channel, raw) => {
      try {
        const event = JSON.parse(raw) as TicketLiveEvent;
        if (event.workspaceId && event.instagramAccountId && event.ticketId) this.emitter.emit('event', event);
      } catch {
        // Ignore malformed messages.
      }
    });
  }

  onModuleDestroy(): void {
    this.subscriber?.disconnect();
  }
}
