jest.mock('@nestjs/common', () => {
  class Logger {
    log = jest.fn();
    debug = jest.fn();
    warn = jest.fn();
    error = jest.fn();
  }
  return {
    Injectable: () => () => {},
    Logger,
  };
});
jest.mock('@nestjs/config', () => ({ ConfigService: class {} }));

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  SendEmailCommand: jest.fn().mockImplementation((input) => input),
}));

import { EmailService } from './email.service';

function makeConfigService(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'email') {
        return {
          awsRegion: 'ap-south-1',
          awsAccessKeyId: 'key-1',
          awsSecretAccessKey: 'secret-1',
          sesConfigurationSet: 'orincore-crm',
          ...overrides,
        };
      }
      throw new Error(`unexpected config key ${key}`);
    }),
  } as any;
}

describe('EmailService', () => {
  beforeEach(() => sendMock.mockClear());

  it('sends through SES using the sender alias for the given kind', async () => {
    const service = new EmailService(makeConfigService());
    await service.send({ to: 'person@example.com', from: 'noreply', subject: 'Hi', html: '<p>Hi</p>' });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const command = sendMock.mock.calls[0][0];
    expect(command.FromEmailAddress).toContain('noreply@notifications.orincore.com');
    expect(command.Destination.ToAddresses).toEqual(['person@example.com']);
    expect(command.ConfigurationSetName).toBe('orincore-crm');
  });

  it('is a no-op when SES credentials are not configured', async () => {
    const service = new EmailService(
      makeConfigService({ awsAccessKeyId: undefined, awsSecretAccessKey: undefined }),
    );
    expect(service.isConfigured).toBe(false);

    await expect(
      service.send({ to: 'person@example.com', from: 'noreply', subject: 'Hi', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('propagates SES failures so callers without a fallback can react', async () => {
    sendMock.mockRejectedValueOnce(new Error('throttled'));
    const service = new EmailService(makeConfigService());

    await expect(
      service.send({ to: 'person@example.com', from: 'noreply', subject: 'Hi', html: '<p>Hi</p>' }),
    ).rejects.toThrow('throttled');
  });
});
