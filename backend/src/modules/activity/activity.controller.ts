import { Controller, Get, Post, Param, Query, Req, Body } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('activity')
export class ActivityController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get activity feed with filtering.
   */
  @Get()
  async getFeed(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('eventType') eventType?: string,
    @Query('severity') severity?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('search') search?: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const where: any = { organizationId: orgId };
    page = Number(page);
    limit = Number(limit);

    if (eventType) where.eventType = eventType;
    if (severity) where.severity = severity;
    if (actorUserId) where.actorUserId = actorUserId;
    if (entityType) where.entityType = entityType;
    if (search) {
      where.OR = [
        { summary: { contains: search, mode: 'insensitive' } },
        { entityName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityEvent.count({ where }),
    ]);

    // Mark as read for current user
    const unreadIds = data.filter((e) => !e.isRead).map((e) => e.id);
    if (unreadIds.length > 0) {
      await this.prisma.activityEvent.updateMany({
        where: { id: { in: unreadIds } },
        data: { isRead: true },
      });
    }

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount: await this.getUnreadCount(orgId),
    };
  }

  /**
   * Get unread count for badge display.
   */
  @Get('unread-count')
  async getUnreadCountEndpoint(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return { count: await this.getUnreadCount(orgId) };
  }

  private async getUnreadCount(orgId: string): Promise<number> {
    return this.prisma.activityEvent.count({
      where: { organizationId: orgId, isRead: false },
    });
  }

  /**
   * Get activity stats/trends.
   */
  @Get('stats')
  async getStats(@Req() req: any, @Query('days') days = 7) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Event counts by type
    const byType = await this.prisma.activityEvent.groupBy({
      by: ['eventType'],
      where: { organizationId: orgId, createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Events per day (trend)
    const byDay: { date: string; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const count = await this.prisma.activityEvent.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });

      byDay.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    // Top actors
    const topActors = await this.prisma.activityEvent.groupBy({
      by: ['actorUserId', 'actorName'],
      where: { organizationId: orgId, createdAt: { gte: since }, actorUserId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return {
      period: `${days} days`,
      totalEvents: byType.reduce((sum, t) => sum + t._count.id, 0),
      byType: byType.map((t) => ({ eventType: t.eventType, count: t._count.id })),
      byDay,
      topActors: topActors.map((a) => ({
        userId: a.actorUserId,
        name: a.actorName || 'Unknown',
        count: a._count.id,
      })),
    };
  }

  /**
   * Get event types for filter dropdown.
   */
  @Get('event-types')
  async getEventTypes(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const types = await this.prisma.activityEvent.groupBy({
      by: ['eventType'],
      where: { organizationId: orgId },
    });
    return types.map((t) => t.eventType);
  }
}