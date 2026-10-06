import { Controller, Get, Post, Delete, Param, Body, Req, BadRequestException, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Controller('api-keys')
export class ApiKeyController {
  private readonly defaultMaxRequests: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultMaxRequests = this.config.get<number>('API_KEY_DEFAULT_MAX_REQUESTS') ?? 10;
  }

  @Get()
  async listKeys(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxApiKeys: true },
    });

    const keys = await this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        maxRequests: true,
        requestCount: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const maxKeys = this.config.get<number>('API_KEY_MAX_KEYS_PER_ORG', 10);
    return {
      keys,
      limits: {
        maxKeys: org?.maxApiKeys ?? maxKeys,
        currentKeys: keys.length,
        remainingSlots: (org?.maxApiKeys ?? maxKeys) - keys.length,
      },
    };
  }

  @Post()
  async createKey(@Req() req: any, @Body() dto: { name: string; scopes: string[]; expiresAt?: string }) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { maxApiKeys: true },
    });

    const maxKeys = this.config.get<number>('API_KEY_MAX_KEYS_PER_ORG', 10);
    const currentKeyCount = await this.prisma.apiKey.count({
      where: { organizationId: orgId, isActive: true },
    });

    if (currentKeyCount >= maxKeys) {
      throw new BadRequestException({
        message: 'Maximum API keys reached',
        errors: [
          `Your organization has reached the limit of ${maxKeys} active API keys.`,
          `Current keys: ${currentKeyCount}/${maxKeys}.`,
          'Please revoke an unused key before creating a new one.',
        ],
        currentCount: currentKeyCount,
        maxAllowed: maxKeys,
      });
    }

    // maxRequests comes strictly from .env — callers cannot override it
    const maxRequests = Number(this.defaultMaxRequests);

    const rawKey = `oc_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 11);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        keyPrefix,
        keyHash,
        scopes: dto.scopes || ['records:read'],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxRequests,
        requestCount: 0,
        createdBy: req.user?.sub,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      maxRequests: apiKey.maxRequests,
      requestCount: 0,
      message: `Save this key now. It will expire after ${maxRequests.toLocaleString()} requests or on the expiry date, whichever comes first.`,
      quotaInfo: {
        maxKeys,
        currentKeys: currentKeyCount + 1,
        remainingKeySlots: maxKeys - (currentKeyCount + 1),
      },
    };
  }

  @Delete(':id')
  async deleteKey(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    await this.prisma.apiKey.deleteMany({ where: { id, organizationId: orgId } });
    return { success: true };
  }

  @Get(':id/usage')
  async getKeyUsage(@Req() req: any, @Param('id') id: string, @Query('days') days: any = 7) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const daysNum = parseInt(String(days), 10) || 7;
    const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const key = await this.prisma.apiKey.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true, name: true, keyPrefix: true, scopes: true, createdAt: true, lastUsedAt: true, expiresAt: true, maxRequests: true, requestCount: true },
    });

    if (!key) throw new NotFoundException('API key not found');

    let totalRequests = 0;
    let errorCount = 0;
    let requestsByDay: any[] = [];
    let requestsByEndpoint: any[] = [];
    let recentRequests: any[] = [];

    try {
      [totalRequests, requestsByDay, requestsByEndpoint, recentRequests, errorCount] = await Promise.all([
        this.prisma.apiKeyUsageLog.count({
          where: { apiKeyId: id, createdAt: { gte: since } },
        }),
        this.prisma.$queryRawUnsafe(`
          SELECT DATE(created_at) as date, COUNT(*)::int as count
          FROM api_key_usage_logs
          WHERE api_key_id = $1 AND created_at >= $2
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `, id, since) as any,
        this.prisma.apiKeyUsageLog.groupBy({
          by: ['endpoint', 'method'],
          where: { apiKeyId: id, createdAt: { gte: since } },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.apiKeyUsageLog.findMany({
          where: { apiKeyId: id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { endpoint: true, method: true, statusCode: true, ipAddress: true, responseTimeMs: true, createdAt: true },
        }),
        this.prisma.apiKeyUsageLog.count({
          where: { apiKeyId: id, createdAt: { gte: since }, statusCode: { gte: 400 } },
        }),
      ]);
    } catch {
      // apiKeyUsageLog table may not exist yet — fall back to requestCount
      totalRequests = key.requestCount;
    }

    return {
      key: {
        name: key.name,
        prefix: key.keyPrefix,
        scopes: key.scopes,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        maxRequests: key.maxRequests,
        requestCount: key.requestCount,
      },
      stats: {
        period: `${daysNum} days`,
        totalRequests,
        errorCount,
        errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) : 0,
        requestsByDay,
        requestsByEndpoint: requestsByEndpoint.map((e: any) => ({
          endpoint: e.endpoint,
          method: e.method,
          count: e._count.id,
        })),
      },
      recentRequests,
    };
  }
}
