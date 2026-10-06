import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ApiKeyUsageService {
  private readonly logger = new Logger(ApiKeyUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackUsage(apiKeyId: string, endpoint: string, method: string, statusCode: number) {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { lastUsedAt: new Date() },
    }).catch(() => {
      this.logger.warn(`Failed to update lastUsedAt for API key ${apiKeyId}`);
    });
  }

  async getUsageStats(apiKeyId: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { lastUsedAt: true, createdAt: true, name: true, scopes: true },
    });

    return {
      keyName: key?.name,
      scopes: key?.scopes,
      createdAt: key?.createdAt,
      lastUsedAt: key?.lastUsedAt,
    };
  }
}
