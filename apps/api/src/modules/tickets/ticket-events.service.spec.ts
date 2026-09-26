import 'reflect-metadata';

jest.mock('@nestjs/common', () => {
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return { Injectable: () => () => {}, Inject: () => () => {}, Global: () => () => {}, Module: () => () => {}, Logger };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

import { EventEmitter } from 'node:events';
import { TicketEventsService } from './ticket-events.service';

function makeRedis() {
  const subscriber = Object.assign(new EventEmitter(), { subscribe: jest.fn().mockResolvedValue(1), disconnect: jest.fn() });
  const redis = { publish: jest.fn().mockResolvedValue(1), duplicate: jest.fn().mockReturnValue(subscriber) } as any;
  return { redis, subscriber };
}

describe('TicketEventsService', () => {
  it('publishes ids and a reason on the shared channel', async () => {
    const { redis } = makeRedis();
    await new TicketEventsService(redis).publish({ workspaceId: 'w1', instagramAccountId: 'a1', ticketId: 't1', reason: 'message' });

    expect(redis.publish).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ workspaceId: 'w1', instagramAccountId: 'a1', ticketId: 't1', reason: 'message' }));
  });

  it('never fails the caller when Redis is down', async () => {
    const { redis } = makeRedis();
    redis.publish.mockRejectedValue(new Error('down'));
    await expect(new TicketEventsService(redis).publish({ workspaceId: 'w1', instagramAccountId: 'a1', ticketId: 't1', reason: 'note' })).resolves.toBeUndefined();
  });

  it('forwards only the connected workspace and account, and no message content', () => {
    const { redis, subscriber } = makeRedis();
    const service = new TicketEventsService(redis);
    const received: any[] = [];
    const sub = service.stream('w1', 'a1').subscribe((e) => received.push(e.data));

    subscriber.emit('message', 'ch', JSON.stringify({ workspaceId: 'w1', instagramAccountId: 'a1', ticketId: 't1', reason: 'message', text: 'secret' }));
    subscriber.emit('message', 'ch', JSON.stringify({ workspaceId: 'w1', instagramAccountId: 'OTHER', ticketId: 't2', reason: 'message' }));
    subscriber.emit('message', 'ch', JSON.stringify({ workspaceId: 'OTHER', instagramAccountId: 'a1', ticketId: 't3', reason: 'message' }));
    subscriber.emit('message', 'ch', 'not json');
    sub.unsubscribe();

    expect(received).toEqual([{ type: 'ready' }, { type: 'ticket', ticketId: 't1', reason: 'message' }]);
  });

  it('shares one Redis subscriber across every connected browser', () => {
    const { redis } = makeRedis();
    const service = new TicketEventsService(redis);
    service.stream('w1', 'a1').subscribe();
    service.stream('w1', 'a1').subscribe();
    expect(redis.duplicate).toHaveBeenCalledTimes(1);
  });
});
