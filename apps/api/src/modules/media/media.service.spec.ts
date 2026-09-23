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

const sendMock = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: sendMock })),
  PutObjectCommand: jest.fn().mockImplementation((input) => input),
}));

import { MediaService } from './media.service';
import { AppException } from '../../common/utils/app-exception';

function makeConfigService(r2Overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'r2') {
        return {
          accountId: 'acc-1',
          accessKeyId: 'key-1',
          secretAccessKey: 'secret-1',
          bucketName: 'convozy',
          publicUrlBase: 'https://convozy.media.orincore.com',
          ...r2Overrides,
        };
      }
      throw new Error(`unexpected config key: ${key}`);
    }),
  } as any;
}

function makeFile(overrides: Record<string, unknown> = {}) {
  return {
    buffer: Buffer.from('fake-bytes'),
    mimetype: 'image/png',
    size: 1024,
    originalname: 'photo.png',
    ...overrides,
  };
}

describe('MediaService.uploadFile', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it('uploads a supported image under workspaces/<id>/image/<uuid>.png and returns its public URL', async () => {
    const service = new MediaService(makeConfigService());

    const result = await service.uploadFile('workspace-1', makeFile());

    expect(sendMock).toHaveBeenCalledTimes(1);
    const putInput = sendMock.mock.calls[0][0];
    expect(putInput.Bucket).toBe('convozy');
    expect(putInput.Key).toMatch(/^workspaces\/workspace-1\/image\/[0-9a-f-]+\.png$/);
    expect(putInput.ContentType).toBe('image/png');

    expect(result.type).toBe('image');
    expect(result.sizeBytes).toBe(1024);
    expect(result.filename).toBe('photo.png');
    expect(result.url).toBe(`https://convozy.media.orincore.com/${putInput.Key}`);
  });

  it('namespaces different media kinds into their own subfolder', async () => {
    const service = new MediaService(makeConfigService());

    await service.uploadFile('workspace-1', makeFile({ mimetype: 'video/mp4', originalname: 'clip.mp4' }));

    const putInput = sendMock.mock.calls[0][0];
    expect(putInput.Key).toMatch(/^workspaces\/workspace-1\/video\/[0-9a-f-]+\.mp4$/);
  });

  it('rejects an unsupported MIME type instead of uploading it', async () => {
    const service = new MediaService(makeConfigService());

    await expect(service.uploadFile('workspace-1', makeFile({ mimetype: 'application/zip' }))).rejects.toThrow(
      AppException,
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects a file over that type's size cap (8MB for images)", async () => {
    const service = new MediaService(makeConfigService());

    await expect(
      service.uploadFile('workspace-1', makeFile({ size: 9 * 1024 * 1024 })),
    ).rejects.toThrow(AppException);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('accepts audio/mpeg (mp3) as a voice-note-capable audio upload', async () => {
    const service = new MediaService(makeConfigService());

    const result = await service.uploadFile(
      'workspace-1',
      makeFile({ mimetype: 'audio/mpeg', originalname: 'voice-note.mp3', size: 2 * 1024 * 1024 }),
    );

    const putInput = sendMock.mock.calls[0][0];
    expect(putInput.Key).toMatch(/^workspaces\/workspace-1\/audio\/[0-9a-f-]+\.mp3$/);
    expect(result.type).toBe('audio');
  });

  it('allows a video up to its own larger 25MB cap', async () => {
    const service = new MediaService(makeConfigService());

    await expect(
      service.uploadFile(
        'workspace-1',
        makeFile({ mimetype: 'video/mp4', originalname: 'clip.mp4', size: 20 * 1024 * 1024 }),
      ),
    ).resolves.toEqual(expect.objectContaining({ type: 'video' }));
  });

  it('throws instead of uploading when R2 is not configured', async () => {
    const service = new MediaService(makeConfigService({ accountId: undefined, accessKeyId: undefined }));

    await expect(service.uploadFile('workspace-1', makeFile())).rejects.toThrow(AppException);
  });

  it('wraps an R2 upload failure in an AppException rather than leaking the raw SDK error', async () => {
    sendMock.mockRejectedValueOnce(new Error('network down'));
    const service = new MediaService(makeConfigService());

    await expect(service.uploadFile('workspace-1', makeFile())).rejects.toThrow(AppException);
  });
});
