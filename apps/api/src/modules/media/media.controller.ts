import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { MediaService } from './media.service';

// 25MB — the largest of Meta's per-type caps (video/audio/file); the
// service itself enforces the real per-type limit, this is just a coarse
// upstream guard so multer doesn't buffer something wildly oversized.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() user: RequestUser, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('No file was uploaded.');
    }
    return this.mediaService.uploadFile(user.workspaceId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
      originalname: file.originalname,
    });
  }
}
