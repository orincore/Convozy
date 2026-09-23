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

const normalizeAudioToM4aMock = jest.fn().mockResolvedValue(Buffer.from('normalized-audio-bytes'));
jest.mock('./audio-normalizer', () => ({
  normalizeAudioToM4a: (...args: unknown[]) => normalizeAudioToM4aMock(...args),
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
    normalizeAudioToM4aMock.mockClear();
    normalizeAudioToM4aMock.mockResolvedValue(Buffer.from('normalized-audio-bytes'));
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

  it('accepts audio/mpeg (mp3) as a voice-note-capable audio upload, normalized to m4a', async () => {
    // mp3 isn't itself a Meta-documented format (confirmed via a live "format
    // not supported" rejection, error_subcode 2534080) — normalizeAudioToM4a
    // is what actually makes it work as a sent voice note.
    const service = new MediaService(makeConfigService());

    const result = await service.uploadFile(
      'workspace-1',
      makeFile({ mimetype: 'audio/mpeg', originalname: 'voice-note.mp3', size: 2 * 1024 * 1024 }),
    );

    expect(normalizeAudioToM4aMock).toHaveBeenCalledTimes(1);
    const putInput = sendMock.mock.calls[0][0];
    expect(putInput.Key).toMatch(/^workspaces\/workspace-1\/audio\/[0-9a-f-]+\.m4a$/);
    expect(putInput.ContentType).toBe('audio/mp4');
    expect(putInput.Body).toEqual(Buffer.from('normalized-audio-bytes'));
    expect(result.type).toBe('audio');
  });

  it('normalizes every audio upload to canonical m4a/audio-mp4 regardless of the source MIME type (audio/x-m4a)', async () => {
    // Regression test: Chrome/Safari report .m4a uploads as "audio/x-m4a", a
    // non-standard type; separately, a raw Apple Voice Memos export fails
    // Meta's Graph API ingest outright (generic "upload failed",
    // error_subcode 2018007) unless re-encoded with a faststart moov atom —
    // reproduced live against production and fixed by always routing kind
    // 'audio' uploads through normalizeAudioToM4a.
    const service = new MediaService(makeConfigService());

    await service.uploadFile(
      'workspace-1',
      makeFile({ mimetype: 'audio/x-m4a', originalname: 'voice-note.m4a', size: 2 * 1024 * 1024 }),
    );

    const putInput = sendMock.mock.calls[0][0];
    expect(putInput.ContentType).toBe('audio/mp4');
    expect(putInput.Key).toMatch(/\.m4a$/);
  });

  it('wraps an ffmpeg normalization failure in an AppException instead of uploading a broken file', async () => {
    normalizeAudioToM4aMock.mockRejectedValueOnce(new Error('ffmpeg audio normalization failed: exit code 1'));
    const service = new MediaService(makeConfigService());

    await expect(
      service.uploadFile('workspace-1', makeFile({ mimetype: 'audio/wav', originalname: 'note.wav' })),
    ).rejects.toThrow(AppException);
    expect(sendMock).not.toHaveBeenCalled();
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
