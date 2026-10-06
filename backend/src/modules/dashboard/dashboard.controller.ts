import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { WidgetDataService } from './widget-data.service';

@Controller('dashboards')
export class DashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly widgetData: WidgetDataService,
  ) {}

  // =====================
  // Dashboards CRUD
  // =====================

  @Get()
  async listDashboards(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.dashboard.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { widgets: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post()
  async createDashboard(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.dashboard.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        layout: dto.layout || {},
        isDefault: dto.isDefault || false,
        isPublic: dto.isPublic || true,
        createdBy: req.user?.sub,
      },
    });
  }

  @Get(':id')
  async getDashboard(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.dashboard.findFirst({
      where: { id, organizationId: orgId },
      include: { widgets: { orderBy: { createdAt: 'asc' } } },
    });
  }

  @Get(':id/full')
  async getFullDashboard(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.dashboard.findFirst({
      where: { id, organizationId: orgId },
      include: { widgets: { orderBy: { createdAt: 'asc' } } },
    });
  }

  @Put(':id')
  async updateDashboard(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.dashboard.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        layout: dto.layout,
        isPublic: dto.isPublic,
        isDefault: dto.isDefault,
      },
    });
  }

  @Delete(':id')
  async deleteDashboard(@Param('id') id: string) {
    return this.prisma.dashboard.delete({ where: { id } });
  }

  // =====================
  // Widgets
  // =====================

  @Post(':dashboardId/widgets')
  async addWidget(@Param('dashboardId') dashboardId: string, @Body() dto: any) {
    return this.prisma.dashboardWidget.create({
      data: {
        dashboardId,
        name: dto.name,
        widgetType: dto.widgetType,
        dataSource: dto.dataSource || 'golden_records',  // ← ADD THIS DEFAULT
        config: dto.config || {},
        position: dto.position || { x: 0, y: 0, w: 3, h: 2 },
        refreshSeconds: dto.refreshSeconds || 0,
      },
    });
  }

  @Put('widgets/:widgetId')
async updateWidget(@Param('widgetId') widgetId: string, @Body() dto: any) {
  return this.prisma.dashboardWidget.update({
    where: { id: widgetId },
    data: {
      name: dto.name,
      widgetType: dto.widgetType,
      dataSource: dto.dataSource || 'golden_records',
      config: dto.config,
      position: dto.position,
      refreshSeconds: dto.refreshSeconds,
    },
  });
}

  @Delete('widgets/:widgetId')
  async deleteWidget(@Param('widgetId') widgetId: string) {
    return this.prisma.dashboardWidget.delete({ where: { id: widgetId } });
  }

  /**
   * Execute a widget and return live data.
   * This is the endpoint that the frontend calls for each widget.
   */
  @Get('widgets/:widgetId/data')
  async getWidgetData(@Param('widgetId') widgetId: string, @Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const widget = await this.prisma.dashboardWidget.findUnique({
      where: { id: widgetId },
      include: { dashboard: true },
    });

    if (!widget || widget.dashboard.organizationId !== orgId) {
      throw new Error('Widget not found');
    }

    const config = widget.config as any;
    return this.widgetData.executeWidget(widget.widgetType, orgId, {
      entityName: config.entityName,
      field: config.field,
      fields: config.fields,
      filters: config.filters,
      aggregation: config.aggregation,
      groupBy: config.groupBy,
      sortField: config.sortField,
      sortDirection: config.sortDirection,
      limit: config.limit,
      dateRange: config.dateRange,
      trendField: config.trendField,
      trendInterval: config.trendInterval,
    });
  }

  /**
 * Get the current user's workspace summary.
 * This is the default dashboard view showing:
 * - Pending tasks
 * - Recent records
 * - Notifications count
 * - Data quality score
 * - Recent activity
 */
@Get('my/workspace')
async getMyWorkspace(@Req() req: any) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const userId = req.user?.sub;

  // Get all data in parallel
  const [
    pendingTasks,
    recentRecords,
    notificationsCount,
    dataQualityScore,
    recentActivity,
    pendingSuggestions,
  ] = await Promise.all([
    // Pending tasks
    this.prisma.workflowTask.findMany({
      where: {
        status: 'pending',
        OR: [
          { assigneeId: userId },
          { assigneeRole: { in: req.user?.realm_access?.roles || [] } },
        ],
      },
      include: {
        instance: {
          select: {
            definition: { select: { name: true } },
            triggerData: true,
          },
        },
      },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),

    // Recent records created by this user
    this.prisma.goldenRecord.findMany({
      where: {
        organizationId: orgId,
        status: 'active',
        deletedAt: null,
      },
      select: {
        id: true,
        data: true,
        createdAt: true,
        updatedAt: true,
        entityDefinition: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),

    // Unread notifications count
    this.prisma.notification.count({
      where: {
        organizationId: orgId,
        recipient: userId,
        status: { in: ['sent', 'delivered'] },
      },
    }),

    // Data quality score
    this.prisma.validationResult.count({
      where: {
        rule: { organizationId: orgId },
        status: 'open',
      },
    }).then(async (openIssues) => {
      const fixedIssues = await this.prisma.validationResult.count({
        where: {
          rule: { organizationId: orgId },
          status: 'fixed',
        },
      });
      const total = openIssues + fixedIssues;
      return total > 0 ? Math.round((fixedIssues / total) * 100) : 100;
    }),

    // Recent activity
    this.prisma.activityEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        eventType: true,
        summary: true,
        entityName: true,
        actorName: true,
        severity: true,
        // occurredAt: true,
      },
    }),

    // Pending suggestions
    this.prisma.suggestion.count({
      where: { organizationId: orgId, status: 'pending' },
    }),
  ]);

  return {
    pendingTasks: {
      total: pendingTasks.length,
      items: pendingTasks.map((t) => ({
        id: t.id,
        taskName: t.taskName,
        workflow: t.instance?.definition?.name || 'Unknown',
        dueAt: t.dueAt,
        status: t.status,
        clickAction: { type: 'navigate', url: `/workflows` },
      })),
    },
    recentRecords: recentRecords.map((r) => ({
      id: r.id,
      title: this.extractTitle(r.data),
      entityType: r.entityDefinition?.name || 'unknown',
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    notifications: {
      total: notificationsCount,
    },
    dataQualityScore,
    recentActivity: recentActivity.map((a) => ({
      eventType: a.eventType,
      summary: a.summary,
      entityName: a.entityName,
      actorName: a.actorName,
      severity: a.severity,
      // occurredAt: a.occurredAt,
    })),
    pendingSuggestions,
  };
}

private extractTitle(data: any): string {
  if (!data) return 'Untitled';
  const d = data as Record<string, any>;
  const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
  return name || d.name || d.farm_name || d.household_id || 'Untitled';
}
}