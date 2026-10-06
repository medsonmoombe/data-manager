import { Controller, Get, Post, Put, Delete, Param, Body, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { WebhookService } from './webhook.service';
import * as crypto from 'crypto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
  ) {}

  @Get()
  async listWebhooks(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.webhook.findMany({
      where: { organizationId: orgId },
      include: {
        _count: { select: { deliveries: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  async createWebhook(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    // Generate a secret if not provided
    const secret = dto.secret || crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    const webhook = await this.prisma.webhook.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        url: dto.url,
        eventTypes: dto.eventTypes || ['*'],
        secretHash,
      },
    });

    return {
      ...webhook,
      secret, // Return secret only once on creation
      message: 'Save this secret — it will not be shown again',
    };
  }

  @Put(':id')
  async updateWebhook(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.webhook.update({
      where: { id },
      data: {
        name: dto.name,
        url: dto.url,
        eventTypes: dto.eventTypes,
        isActive: dto.isActive,
      },
    });
  }

  @Delete(':id')
  async deleteWebhook(@Param('id') id: string) {
    return this.prisma.webhook.delete({ where: { id } });
  }

  @Post(':id/test')
  async testWebhook(@Param('id') id: string) {
    return this.webhookService.testWebhook(id);
  }

  @Get(':id/deliveries')
  async getDeliveries(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { deliveredAt: 'desc' },
      take: 50,
      select: {
        id: true,
        eventPayload: true,
        responseStatus: true,
        success: true,
        deliveredAt: true,
      },
    });
  }
}