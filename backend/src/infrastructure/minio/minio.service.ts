import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get('MINIO_PORT', '9000')),
      useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucketName = this.configService.get('MINIO_BUCKET', 'omnicore-storage');
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Bucket ${this.bucketName} created`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket: ${error.message}`);
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    metadata?: Record<string, any>,
  ): Promise<{ url: string; path: string; size: number }> {
    const ext = originalName.split('.').pop();
    const filename = `${uuidv4()}${ext ? `.${ext}` : ''}`;
    const objectPath = `uploads/${new Date().toISOString().slice(0, 10)}/${filename}`;

    await this.client.putObject(this.bucketName, objectPath, buffer, buffer.length, {
      'Content-Type': mimeType,
      'X-Amz-Meta-Original-Name': encodeURIComponent(originalName),
      ...metadata,
    });

    // Return a backend-proxied URL instead of a direct MinIO URL.
    // This ensures authentication is enforced when viewing/downloading files.
    const proxyPrefix = this.configService.get(
      'MINIO_PROXY_URL',
      '/api/v1/files/download?path=',
    );
    const url = `${proxyPrefix}${encodeURIComponent(objectPath)}`;

    return { url, path: objectPath, size: buffer.length };
  }

  async getFile(path: string): Promise<{ stream: Readable; metadata: any }> {
    const stat = await this.client.statObject(this.bucketName, path);
    const stream = await this.client.getObject(this.bucketName, path);
    return { stream, metadata: stat.metaData };
  }

  async deleteFile(path: string): Promise<void> {
    await this.client.removeObject(this.bucketName, path);
  }

  async generatePresignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucketName, path, expiresInSeconds);
  }

  async listFiles(prefix: string, limit = 100) {
    const objects: Array<{ name: string; size: number; lastModified: Date }> = [];
    const stream = this.client.listObjects(this.bucketName, prefix, true);

    return new Promise<typeof objects>((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name && objects.length < limit) {
          objects.push({ name: obj.name, size: obj.size ?? 0, lastModified: obj.lastModified ?? new Date() });
        }
      });
      stream.on('end', () => resolve(objects));
      stream.on('error', reject);
    });
  }
}
