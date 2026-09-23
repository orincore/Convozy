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
}

// Keyed by MIME type. Deliberately only the formats Meta documents as
// supported — anything else is rejected at upload time rather than
// accepted and failing later at send time.
const SUPPORTED_MIME_TYPES: Record<string, MediaTypeSpec> = {
  'image/png': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'png' },
  'image/jpeg': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'jpg' },
  'image/gif': { kind: 'image', maxBytes: 8 * 1024 * 1024, extension: 'gif' },
  'video/mp4': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'mp4' },
  'video/ogg': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'ogv' },
  'video/webm': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'webm' },
  'video/quicktime': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'mov' },
  'video/x-msvideo': { kind: 'video', maxBytes: 25 * 1024 * 1024, extension: 'avi' },
  'audio/aac': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'aac' },
  'audio/mp4': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'm4a' },
  'audio/x-m4a': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'm4a' },
  'audio/wav': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'wav' },
  'audio/x-wav': { kind: 'audio', maxBytes: 25 * 1024 * 1024, extension: 'wav' },
  'application/pdf': { kind: 'file', maxBytes: 25 * 1024 * 1024, extension: 'pdf' },
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
          ContentType: file.mimetype,
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
