import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // =====================
  // Templates
  // =====================

  @Get('templates')
  async listTemplates(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.notificationTemplate.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('templates')
  async createTemplate(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.notificationTemplate.create({
      data: { organizationId: orgId, ...dto },
    });
  }

  @Put('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.notificationTemplate.update({ where: { id }, data: dto });
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    return this.prisma.notificationTemplate.delete({ where: { id } });
  }

  // =====================
  // Channel Configuration
  // =====================

  @Get('channels')
  async listChannels(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.notificationChannel.findMany({
      where: { organizationId: orgId },
    });
  }

  @Post('channels')
  async createChannel(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    // If this is the first channel of its type, make it default
    const existingCount = await this.prisma.notificationChannel.count({
      where: { organizationId: orgId, channel: dto.channel },
    });

    return this.prisma.notificationChannel.create({
      data: {
        organizationId: orgId,
        channel: dto.channel,
        provider: dto.provider,
        config: dto.config,
        isDefault: existingCount === 0,
      },
    });
  }

  // =====================
  // Preferences
  // =====================

  @Get('preferences')
  async getPreferences(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;

    return this.prisma.notificationPreference.findMany({
      where: { organizationId: orgId, userId },
    });
  }

  @Post('preferences')
  async setPreference(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;

    return this.prisma.notificationPreference.upsert({
      where: {
        organizationId_userId_channel_category: {
          organizationId: orgId,
          userId,
          channel: dto.channel,
          category: dto.category,
        },
      },
      create: { organizationId: orgId, userId, channel: dto.channel, category: dto.category, isEnabled: dto.isEnabled },
      update: { isEnabled: dto.isEnabled },
    });
  }

  // =====================
  // Send & History
  // =====================

  @Post('send')
  async sendNotification(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.notificationService.createAndDispatch({
      orgId,
      channel: dto.channel,
      recipient: dto.recipient,
      message: dto.message,
      templateId: dto.templateId,
      params: dto.params,
      priority: dto.priority,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
    });
  }

  @Get()
  async listNotifications(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (channel) where.channel = channel;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { template: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  @Get('my')
  async getMyNotifications(@Req() req: any, @Query('status') status?: string) {
    const userId = req.user?.sub;
    const where: any = { recipient: userId };
    if (status) where.status = status;

    return this.prisma.notification.findMany({
      where,
      include: { template: { select: { name: true, category: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: 'read' },
    });
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user?.sub;
    await this.prisma.notification.updateMany({
      where: { recipient: userId, status: { in: ['sent', 'delivered'] } },
      data: { readAt: new Date(), status: 'read' },
    });
    return { success: true };
  }
}