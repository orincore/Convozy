import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/utils/app-exception';
import { AppConfig } from '../../config/configuration';
import { normalizeAudioToM4a } from './audio-normalizer';

// Meta's own hard caps for Instagram DM attachments (Attachment Upload API /
// send-message docs) — validated at upload time so a creator gets a clear
// error immediately instead of an automation silently failing to send
// later. See MessagingService for the corresponding send-time shape.
export type MediaKind = 'image' | 'video' | 'audio' | 'file';

interface MediaTypeSpec {
  kind: MediaKind;
  maxBytes: number;
  extension: string;
  // The Content-Type stored on the R2 object and thus served to Meta's
  // fetcher — deliberately NOT always equal to the map key. Browsers report
  // non-standard MIME types for some containers (e.g. Chrome/Safari send
  // "audio/x-m4a" for .m4a files, which isn't an IANA-registered type).
  // Meta's server rejects unrecognized Content-Type headers with a generic
  // "upload failed" (error_subcode 2018007) even though the file itself is
  // fine — so every upload is re-served under its canonical MIME type
  // regardless of what the uploading browser claimed.
  canonicalContentType: string;
}

// Keyed by MIME type. Deliberately only the formats Meta documents as
// supported — anything else is rejected at upload time rather than
// accepted and failing later at send time.
//
// Voice notes: Instagram's Send API has no distinct "voice message" type
// like WhatsApp's Cloud API does (audio.voice: true, OGG/OPUS-only) —
// confirmed against Meta's current Instagram messaging docs, which only
// document a generic `type: "audio"` attachment. Any audio file sent this
// way already renders as a playable audio bubble in the DM thread, so a
// creator's m4a/mp3/wav recording already *is* the closest thing Instagram
// has to a voice note; there's no separate flag or endpoint to opt into.
//
// Every kind:'audio' upload is re-encoded through ffmpeg to one canonical
// faststart AAC/m4a shape regardless of source format — see
// audio-normalizer.ts for why this is load-bearing, not just cleanup: a raw
// Apple Voice Memos export (the single most common real "voice note"
// source) fails Meta's ingest with a generic "upload failed" otherwise, and
// raw mp3 is flatly rejected by Meta as an unsupported format. Accepting
// mp3/wav/aac/m4a as *input* here and normalizing all of them means every
// one of those genuinely works as a sent voice note, not just the
// documented ones.
const SUPPORTED_MIME_TYPES: Record<string, MediaTypeSpec> = {
  'image/png': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'png', canonicalContentType: 'image/png' },
  'image/jpeg': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'jpg', canonicalContentType: 'image/jpeg' },
  'image/gif': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'gif', canonicalContentType: 'image/gif' },
  'video/mp4': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'mp4', canonicalContentType: 'video/mp4' },
  'video/ogg': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'ogv', canonicalContentType: 'video/ogg' },
  'video/webm': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'webm', canonicalContentType: 'video/webm' },
  'video/quicktime': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'mov', canonicalContentType: 'video/quicktime' },
  'video/x-msvideo': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'avi', canonicalContentType: 'video/x-msvideo' },
  // Every audio entry's `extension`/`canonicalContentType` below is only
  // used for input validation (MIME type -> accepted?, size cap) — the
  // actual stored extension/Content-Type is always m4a/audio-mp4 once
  // uploadFile() normalizes the buffer through ffmpeg, regardless of which
  // of these keys matched.
  'audio/aac': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'aac', canonicalContentType: 'audio/aac' },
  'audio/mp4': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'm4a', canonicalContentType: 'audio/mp4' },
  'audio/x-m4a': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'm4a', canonicalContentType: 'audio/mp4' },
  'audio/wav': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'wav', canonicalContentType: 'audio/wav' },
  'audio/x-wav': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'wav', canonicalContentType: 'audio/wav' },
  'audio/mpeg': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'mp3', canonicalContentType: 'audio/mpeg' },
  'application/pdf': { kind: 'file', maxBytes: 25 * 1024 * 1024, extension: 'pdf', canonicalContentType: 'application/pdf' },
};

export interface UploadedMediaFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export interface MediaUploadResult {
  url: string;
  type: MediaKind;
  sizeBytes: number;
  filename: string;
}

/**
 * Owns every upload to the R2 bucket used for DM media attachments —
 * stored under `workspaces/<workspaceId>/<type>/<uuid>.<ext>` so objects
 * are namespaced per workspace (future cleanup/quota work has a clean
 * boundary to key off) and browsable by type. The bucket's custom domain
 * (R2_PUBLIC_URL_BASE) must already be configured for public access —
 * Meta's servers fetch the URL directly when the message is sent, an R2
 * object that's still private would fail every send.
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly client: S3Client | null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const r2 = this.configService.get('r2', { infer: true });
    this.client =
      r2.accountId && r2.accessKeyId && r2.secretAccessKey
        ? new S3Client({
            region: 'auto',
            endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
          })
        : null;
  }

  async uploadFile(workspaceId: string, file: UploadedMediaFile): Promise<MediaUploadResult> {
    const r2 = this.configService.get('r2', { infer: true });
    if (!this.client || !r2.bucketName || !r2.publicUrlBase) {
      throw new AppException('MEDIA_UPLOAD_UNAVAILABLE', 'Media uploads are not configured on this server.');
    }

    const spec = SUPPORTED_MIME_TYPES[file.mimetype];
    if (!spec) {
      throw new AppException(
        'UNSUPPORTED_MEDIA_TYPE',
        `"${file.mimetype}" isn't a supported file type. Supported: PNG/JPEG/GIF images, MP4/OGG/WEBM/MOV/AVI video, AAC/M4A/WAV/MP3 audio, or PDF.`,
      );
    }
    if (file.size > spec.maxBytes) {
      throw new AppException(
        'MEDIA_TOO_LARGE',
        `This ${spec.kind} is ${(file.size / (1024 * 1024)).toFixed(1)}MB, over Instagram's ${spec.maxBytes / (1024 * 1024)}MB limit for ${spec.kind} attachments.`,
      );
    }

    let body = file.buffer;
    let extension = spec.extension;
    let contentType = spec.canonicalContentType;

    if (spec.kind === 'audio') {
      try {
        body = await normalizeAudioToM4a(file.buffer);
      } catch (err) {
        this.logger.error(`Audio normalization failed for workspace ${workspaceId}: ${(err as Error).message}`);
        throw new AppException(
          'AUDIO_PROCESSING_FAILED',
          "Couldn't process this audio file. Try a different recording or format.",
        );
      }
      // Normalization always produces the same canonical faststart AAC/m4a
      // shape, regardless of what format the creator uploaded.
      extension = 'm4a';
      contentType = 'audio/mp4';
    }

    const key = `workspaces/${workspaceId}/${spec.kind}/${randomUUID()}.${extension}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: r2.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      this.logger.error(`R2 upload failed for workspace ${workspaceId}: ${(err as Error).message}`);
      throw new AppException('MEDIA_UPLOAD_FAILED', 'Could not upload this file. Please try again.');
    }

    return {
      url: `${r2.publicUrlBase.replace(/\/$/, '')}/${key}`,
      type: spec.kind,
      // Audio's actual stored size differs from the upload (re-encoded);
      // every other kind is stored byte-for-byte, so the declared size is
      // already accurate and avoids relying on the mock buffer in tests.
      sizeBytes: spec.kind === 'audio' ? body.length : file.size,
      filename: file.originalname,
    };
  }
}
