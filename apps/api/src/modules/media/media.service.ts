import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/utils/app-exception';
import { AppConfig } from '../../config/configuration';

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
// audio/mpeg (mp3) is included here per an explicit user request even
// though Meta's own audio-format table only lists aac/m4a/wav/mp4 — mp3 is
// NOT documented as supported for Instagram (only for WhatsApp). Treated
// like the private-reply-attachment combination elsewhere in this file:
// shipped as best-effort, watch MessageLog for a Graph API rejection.
const SUPPORTED_MIME_TYPES: Record<string, MediaTypeSpec> = {
  'image/png': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'png', canonicalContentType: 'image/png' },
  'image/jpeg': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'jpg', canonicalContentType: 'image/jpeg' },
  'image/gif': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'gif', canonicalContentType: 'image/gif' },
  'video/mp4': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'mp4', canonicalContentType: 'video/mp4' },
  'video/ogg': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'ogv', canonicalContentType: 'video/ogg' },
  'video/webm': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'webm', canonicalContentType: 'video/webm' },
  'video/quicktime': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'mov', canonicalContentType: 'video/quicktime' },
  'video/x-msvideo': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'avi', canonicalContentType: 'video/x-msvideo' },
  // m4a's canonical/IANA-registered type is audio/mp4 — "audio/x-m4a" (what
  // Chrome/Safari actually report for the file) is accepted as upload
  // input but never stored as the served Content-Type.
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
        `"${file.mimetype}" isn't a supported file type. Supported: PNG/JPEG/GIF images, MP4/OGG/WEBM/MOV/AVI video, AAC/M4A/WAV audio, or PDF.`,
      );
    }
    if (file.size > spec.maxBytes) {
      throw new AppException(
        'MEDIA_TOO_LARGE',
        `This ${spec.kind} is ${(file.size / (1024 * 1024)).toFixed(1)}MB, over Instagram's ${spec.maxBytes / (1024 * 1024)}MB limit for ${spec.kind} attachments.`,
      );
    }

    const key = `workspaces/${workspaceId}/${spec.kind}/${randomUUID()}.${spec.extension}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: r2.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: spec.canonicalContentType,
        }),
      );
    } catch (err) {
      this.logger.error(`R2 upload failed for workspace ${workspaceId}: ${(err as Error).message}`);
      throw new AppException('MEDIA_UPLOAD_FAILED', 'Could not upload this file. Please try again.');
    }

    return {
      url: `${r2.publicUrlBase.replace(/\/$/, '')}/${key}`,
      type: spec.kind,
      sizeBytes: file.size,
      filename: file.originalname,
    };
  }
}
