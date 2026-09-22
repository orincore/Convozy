jest.mock('@nestjs/bullmq', () => ({
  Processor: () => () => {},
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

import { MessageSendProcessor } from './message-send.processor';

function makeFailedJob(id: string, data: Record<string, unknown>) {
  return { id, name: 'send', data, remove: jest.fn() } as any;
}

function makeProcessor(failedJobs: any[] = []) {
  const messagingService = { send: jest.fn() } as any;
  const instagramService = { isAccountActive: jest.fn().mockResolvedValue(true) } as any;
  const messageSendQueue = {
    add: jest.fn(),
    getFailed: jest.fn().mockResolvedValue(failedJobs),
  } as any;

  const processor = new MessageSendProcessor(messagingService, instagramService, messageSendQueue);
  return { processor, messagingService, instagramService, messageSendQueue };
}

describe('MessageSendProcessor', () => {
  it('routes a "send" job to MessagingService.send', async () => {
    const { processor, messagingService } = makeProcessor();
    const job = { name: 'send', data: { actionType: 'SEND_DM', recipientId: 'r', instagramAccountId: 'a' } } as any;

    await processor.process(job);

    expect(messagingService.send).toHaveBeenCalledWith(job);
  });

  it('routes a "dlq-requeue-scan" job to the requeue scan instead of MessagingService', async () => {
    const { processor, messagingService, messageSendQueue } = makeProcessor([]);
    const job = { name: 'dlq-requeue-scan', data: {} } as any;

    await processor.process(job);

    expect(messagingService.send).not.toHaveBeenCalled();
    expect(messageSendQueue.getFailed).toHaveBeenCalled();
  });

  it('requeues a failed job for an active account under the round cap', async () => {
    const failedJob = makeFailedJob('job-1', { instagramAccountId: 'account-1', requeueRound: 1 });
    const { processor, messageSendQueue } = makeProcessor([failedJob]);

    await processor.process({ name: 'dlq-requeue-scan', data: {} } as any);

    expect(failedJob.remove).toHaveBeenCalled();
    expect(messageSendQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ instagramAccountId: 'account-1', requeueRound: 2 }),
      // Hyphens, not colons - BullMQ 5.x rejects ":" in custom job IDs.
      expect.objectContaining({ jobId: 'job-1-requeue-2' }),
    );
  });

  it('never requeues the scan job itself even if it somehow shows up as failed', async () => {
    const scanJob = makeFailedJob('scan-1', {});
    scanJob.name = 'dlq-requeue-scan';
    const { processor, messageSendQueue } = makeProcessor([scanJob]);

    await processor.process({ name: 'dlq-requeue-scan', data: {} } as any);

    expect(scanJob.remove).not.toHaveBeenCalled();
    expect(messageSendQueue.add).not.toHaveBeenCalledWith('send', expect.anything(), expect.anything());
  });

  it('gives up once a job has hit the max requeue rounds — leaving it in the failed set, not requeuing', async () => {
    const failedJob = makeFailedJob('job-1', { instagramAccountId: 'account-1', requeueRound: 5 });
    const { processor, messageSendQueue } = makeProcessor([failedJob]);

    await processor.process({ name: 'dlq-requeue-scan', data: {} } as any);

    expect(failedJob.remove).not.toHaveBeenCalled();
    expect(messageSendQueue.add).not.toHaveBeenCalledWith('send', expect.anything(), expect.anything());
  });

  it('skips requeueing when the account is no longer active (permanent until reconnect)', async () => {
    const failedJob = makeFailedJob('job-1', { instagramAccountId: 'account-1', requeueRound: 0 });
    const { processor, messageSendQueue, instagramService } = makeProcessor([failedJob]);
    instagramService.isAccountActive.mockResolvedValue(false);

    await processor.process({ name: 'dlq-requeue-scan', data: {} } as any);

    expect(failedJob.remove).not.toHaveBeenCalled();
    expect(messageSendQueue.add).not.toHaveBeenCalledWith('send', expect.anything(), expect.anything());
  });
});
