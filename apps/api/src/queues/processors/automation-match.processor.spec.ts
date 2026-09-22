// This processor statically imports AutomationsService, so its whole
// transitive import graph (PrismaService, ConfigService, etc.) must load
// without error even though the test constructs AutomationMatchProcessor
// with a hand-rolled stub, not the real AutomationsService — same pattern
// as automations.service.spec.ts.
jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => {},
  OnWorkerEvent: () => () => {},
  InjectQueue: () => () => {},
  WorkerHost: class {},
}));
jest.mock('@nestjs/common', () => {
  class HttpException extends Error {
    constructor(
      public response: unknown,
      public status: number,
    ) {
      super(typeof response === 'string' ? response : JSON.stringify(response));
    }
  }
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return {
    Injectable: () => () => {},
    Inject: () => () => {},
    Global: () => () => {},
    Module: () => () => {},
    Logger,
    HttpException,
    HttpStatus: { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, FORBIDDEN: 403 },
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

import { AutomationMatchProcessor } from './automation-match.processor';

function makeProcessor() {
  const automationsService = { matchCommentEvent: jest.fn() } as any;
  const processor = new AutomationMatchProcessor(automationsService);
  return { processor, automationsService };
}

describe('AutomationMatchProcessor', () => {
  it('delegates matching to AutomationsService with the job’s commentEventId', async () => {
    const { processor, automationsService } = makeProcessor();

    await processor.process({ data: { commentEventId: 'evt-1' } } as any);

    expect(automationsService.matchCommentEvent).toHaveBeenCalledWith('evt-1');
  });

  it('logs a permanent-failure error once BullMQ exhausts all attempts', () => {
    // Regression test: this handler didn't exist when a real automation
    // match silently failed 5 times with zero log output (the underlying
    // bug was a colon in a BullMQ job ID - see automations.service.ts).
    // Without this, a permanently-failed job is invisible outside directly
    // inspecting BullMQ's failed set in Redis.
    const { processor } = makeProcessor();
    const job = { data: { commentEventId: 'evt-1' }, attemptsMade: 5 } as any;

    expect(() => processor.onFailed(job, new Error('Custom Id cannot contain :'))).not.toThrow();
    expect((processor as any).logger.error).toHaveBeenCalledWith(
      expect.stringContaining('evt-1'),
    );
  });
});
