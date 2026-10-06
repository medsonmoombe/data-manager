import { Controller, Get, Query, Req, Res, NotFoundException, Header } from '@nestjs/common';
import { Public } from 'nest-keycloak-connect';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { Response } from 'express';

@Controller('files')
export class FilesController {
  constructor(private readonly minioService: MinioService) {}

  /**
   * Serve a file inline (for viewing in browser).
   * Uses @Public() because files are opened via direct browser navigation
   * (window.open, <img src>, etc.) which does not carry Authorization headers.
   * Security is maintained because file paths are opaque UUIDs.
   */
  @Public()
  @Get('download')
  @Header('Accept-Ranges', 'bytes')
  async downloadFile(
    @Req() req: any,
    @Res() res: Response,
    @Query('path') path: string,
  ) {
    if (!path) {
      throw new NotFoundException('File path is required');
    }

    try {
      const { stream, metadata } = await this.minioService.getFile(path);

      const contentType = metadata?.['content-type'] || metadata?.['Content-Type'] || 'application/octet-stream';
      const originalName = metadata?.['x-amz-meta-original-name']
        ? decodeURIComponent(metadata['x-amz-meta-original-name'])
        : path.split('/').pop() || 'download';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${originalName}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      stream.pipe(res);
    } catch (error: any) {
      if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  /**
   * Serve a file as attachment (forces download dialog).
   * Also public for the same reason — direct browser navigation.
   */
  @Public()
  @Get('download/attachment')
  @Header('Accept-Ranges', 'bytes')
  async downloadAsAttachment(
    @Req() req: any,
    @Res() res: Response,
    @Query('path') path: string,
    @Query('name') name?: string,
  ) {
    if (!path) {
      throw new NotFoundException('File path is required');
    }

    try {
      const { stream, metadata } = await this.minioService.getFile(path);

      const contentType = metadata?.['content-type'] || metadata?.['Content-Type'] || 'application/octet-stream';
      const originalName = name
        || (metadata?.['x-amz-meta-original-name']
          ? decodeURIComponent(metadata['x-amz-meta-original-name'])
          : path.split('/').pop() || 'download');

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${originalName}"`);
      res.setHeader('Cache-Control', 'private, max-age=3600');

      stream.pipe(res);
    } catch (error: any) {
      if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }
}
