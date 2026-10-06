import { Controller, Get, Post, Put, Body, Req } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('activity/subscriptions')
export class SubscriptionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getSubscription(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;

    const sub = await this.prisma.activitySubscription.findUnique({
      where: { organizationId_userId: { organizationId: orgId, userId } },
    });

    return sub || {
      eventTypes: [],
      channels: ['in_app'],
      isActive: true,
    };
  }

  @Post()
  async upsertSubscription(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;

    return this.prisma.activitySubscription.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId } },
      create: {
        organizationId: orgId,
        userId,
        eventTypes: dto.eventTypes || [],
        channels: dto.channels || ['in_app'],
        isActive: dto.isActive ?? true,
      },
      update: {
        eventTypes: dto.eventTypes,
        channels: dto.channels,
        isActive: dto.isActive,
      },
    });
  }
}