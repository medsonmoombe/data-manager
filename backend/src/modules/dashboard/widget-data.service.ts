import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface WidgetConfig {
  entityName?: string;
  field?: string;
  fields?: string[];
  filters?: Record<string, any>;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  groupBy?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  dateRange?: { field: string; from?: string; to?: string };
  trendField?: string;
  trendInterval?: 'day' | 'week' | 'month';
  sparkline?: boolean;
  sparklinePeriods?: number;
  activeFilters?: Record<string, any>; // Cross-filtering context
}

interface AlertThreshold {
  condition: string;  // "value < 100", "trend < -10"
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

@Injectable()
export class WidgetDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async executeWidget(widgetType: string, orgId: string, config: WidgetConfig): Promise<any> {
    switch (widgetType) {
      case 'number': return this.getNumberWidget(orgId, config);
      case 'bar_chart': return this.getBarChart(orgId, config);
      case 'line_chart': return this.getLineChart(orgId, config);
      case 'pie_chart': return this.getPieChart(orgId, config);
      case 'table': return this.getTableWidget(orgId, config);
      case 'list': return this.getListWidget(orgId, config);
      case 'funnel': return this.getFunnelWidget(orgId, config);
      case 'kpi_card': return this.getKpiCard(orgId, config);
      default: return { data: [], message: `Unknown widget type: ${widgetType}` };
    }
  }

  /**
   * KPI Card: Rich metric with sparkline and trend.
   */
  private async getKpiCard(orgId: string, config: WidgetConfig): Promise<any> {
    const entityDef = await this.getEntityDef(orgId, config.entityName);
    if (!entityDef) return this.emptyKpi();

    const filters = this.buildFilters(orgId, entityDef.id, config);
    const currentValue = await this.prisma.goldenRecord.count({ where: filters });

    // Calculate previous period value
    const previousFilters = this.getPreviousPeriodFilters(filters, config);
    const previousValue = await this.prisma.goldenRecord.count({ where: previousFilters });

    const trend = previousValue > 0
      ? Math.round(((currentValue - previousValue) / previousValue) * 100)
      : 0;

    // Generate sparkline data (last N periods)
    let sparkline: number[] = [];
    if (config.sparkline !== false) {
      sparkline = await this.getSparklineData(orgId, entityDef.id, config);
    }

    return {
      value: currentValue,
      label: config.field || config.entityName || 'Count',
      trend,
      trendDirection: trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat',
      sparkline,
      comparisonLabel: 'vs previous period',
      clickAction: {
        type: 'drill_down',
        entityName: config.entityName,
        filters: config.activeFilters || config.filters || {},
      },
    };
  }

  /**
   * Generate sparkline data for trends.
   */
  private async getSparklineData(orgId: string, entityDefId: string, config: WidgetConfig): Promise<number[]> {
    const periods = config.sparklinePeriods || 7;
    const interval = config.trendInterval || 'day';
    const data: number[] = [];

    for (let i = periods - 1; i >= 0; i--) {
      const start = new Date();
      const end = new Date();

      switch (interval) {
        case 'month':
          start.setMonth(start.getMonth() - i);
          end.setMonth(end.getMonth() - i + 1);
          break;
        case 'week':
          start.setDate(start.getDate() - (i + 1) * 7);
          end.setDate(end.getDate() - i * 7);
          break;
        default:
          start.setDate(start.getDate() - i - 1);
          end.setDate(end.getDate() - i);
      }

      const count = await this.prisma.goldenRecord.count({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDefId,
          status: 'active',
          deletedAt: null,
          createdAt: { gte: start, lt: end },
        },
      });

      data.push(count);
    }

    return data;
  }

  private emptyKpi() {
    return {
      value: 0,
      label: 'No data',
      trend: 0,
      trendDirection: 'flat',
      sparkline: [],
      comparisonLabel: '',
      clickAction: null,
    };
  }

  /**
   * Number widget with trend and drill-down.
   */
  private async getNumberWidget(orgId: string, config: WidgetConfig): Promise<any> {
    const kpi = await this.getKpiCard(orgId, config);
    return kpi;
  }

  /**
   * Bar chart with cross-filtering support and drill-down.
   */
  private async getBarChart(orgId: string, config: WidgetConfig): Promise<any> {
    if (!config.groupBy) return { labels: [], values: [], clickActions: [] };

    const entityDef = await this.getEntityDef(orgId, config.entityName);
    if (!entityDef) return { labels: [], values: [], clickActions: [] };

    const filters = this.buildFilters(orgId, entityDef.id, config);
    const records = await this.prisma.goldenRecord.findMany({
      where: filters,
      select: { data: true },
      take: 10000,
    });

    const groups: Record<string, { count: number; sampleId?: string }> = {};
    for (const record of records) {
      const data = record.data as Record<string, any>;
      const value = data[config.groupBy] || 'Unknown';
      if (!groups[value]) groups[value] = { count: 0 };
      groups[value].count++;
    }

    const sorted = Object.entries(groups)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, config.limit || 10);

    return {
      labels: sorted.map(([label]) => label),
      values: sorted.map(([, data]) => data.count),
      groupBy: config.groupBy,
      clickActions: sorted.map(([label]) => ({
        type: 'cross_filter',
        filter: { field: config.groupBy, value: label },
      })),
    };
  }

  /**
   * Line chart with trend over time.
   */
  private async getLineChart(orgId: string, config: WidgetConfig): Promise<any> {
    if (!config.trendField) return { labels: [], datasets: [] };

    const entityDef = await this.getEntityDef(orgId, config.entityName);
    if (!entityDef) return { labels: [], datasets: [] };

    const filters = this.buildFilters(orgId, entityDef.id, config);
    const records = await this.prisma.goldenRecord.findMany({
      where: filters,
      select: { data: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 10000,
    });

    const groups: Record<string, number> = {};
    for (const record of records) {
      const date = this.truncateDate(record.createdAt, config.trendInterval || 'day');
      groups[date] = (groups[date] || 0) + 1;
    }

    const labels = Object.keys(groups).sort();
    const values = labels.map((l) => groups[l]);

    return {
      labels,
      datasets: [{ label: config.field || 'Count', data: values }],
      clickAction: {
        type: 'drill_down',
        entityName: config.entityName,
        filters: config.activeFilters || {},
      },
    };
  }

  /**
   * Pie chart with cross-filtering.
   */
  private async getPieChart(orgId: string, config: WidgetConfig): Promise<any> {
    const barData = await this.getBarChart(orgId, config);
    return {
      labels: barData.labels,
      values: barData.values,
      total: barData.values.reduce((a: number, b: number) => a + b, 0),
      clickActions: barData.clickActions,
    };
  }

  /**
   * Table widget with row click to 360° profile.
   */
  private async getTableWidget(orgId: string, config: WidgetConfig): Promise<any> {
    const entityDef = await this.getEntityDef(orgId, config.entityName);
    if (!entityDef) return { columns: [], rows: [] };

    const filters = this.buildFilters(orgId, entityDef.id, config);
    const records = await this.prisma.goldenRecord.findMany({
      where: filters,
      select: { id: true, data: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: config.limit || 50,
    });

    const columns = config.fields || Object.keys((records[0]?.data as any) || {});
    const rows = records.map((r) => ({
      id: r.id,
      ...(r.data as Record<string, any>),
      _createdAt: r.createdAt,
      _clickAction: {
        type: 'navigate',
        url: `/intelligence/profile/golden_record/${r.id}`,
      },
    }));

    return {
      columns,
      rows,
      total: rows.length,
      exportable: true,
    };
  }

  /**
   * List widget with navigation.
   */
  private async getListWidget(orgId: string, config: WidgetConfig): Promise<any> {
    const entityDef = await this.getEntityDef(orgId, config.entityName);
    if (!entityDef) return { items: [] };

    const filters = this.buildFilters(orgId, entityDef.id, config);
    const records = await this.prisma.goldenRecord.findMany({
      where: filters,
      select: { id: true, data: true },
      take: config.limit || 10,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      items: records.map((r) => ({
        id: r.id,
        title: this.extractTitle(r.data, config.field),
        subtitle: this.extractSubtitle(r.data),
        data: r.data,
        clickAction: {
          type: 'navigate',
          url: `/intelligence/profile/golden_record/${r.id}`,
        },
      })),
    };
  }

  private async getFunnelWidget(orgId: string, config: WidgetConfig): Promise<any> {
    if (!config.field) return { stages: [] };

    const entityDef = await this.getEntityDef(orgId, config.entityName);
    if (!entityDef) return { stages: [] };

    const filters = this.buildFilters(orgId, entityDef.id, config);
    const records = await this.prisma.goldenRecord.findMany({
      where: filters,
      select: { data: true },
      take: 10000,
    });

    const groups: Record<string, number> = {};
    for (const record of records) {
      const data = record.data as Record<string, any>;
      const stage = data[config.field] || 'Unknown';
      groups[stage] = (groups[stage] || 0) + 1;
    }

    return {
      stages: Object.entries(groups)
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // =====================
  // Alert Evaluation
  // =====================

  /**
   * Evaluate alert thresholds for a widget and emit alerts if triggered.
   */
  async evaluateAlerts(widgetId: string, widgetData: any, thresholds: AlertThreshold[]) {
    if (!thresholds || thresholds.length === 0) return;

    const triggered: AlertThreshold[] = [];

    for (const threshold of thresholds) {
      if (this.evaluateCondition(threshold.condition, widgetData)) {
        triggered.push(threshold);
      }
    }

    if (triggered.length > 0) {
      const widget = await this.prisma.dashboardWidget.findUnique({
        where: { id: widgetId },
        include: { dashboard: true },
      });

      if (widget) {
        // Prevent alert spam: only alert if not alerted in last hour
        const canAlert = !widget.lastAlertedAt ||
          (Date.now() - new Date(widget.lastAlertedAt).getTime()) > 60 * 60 * 1000;

        if (canAlert) {
          for (const alert of triggered) {
            this.eventEmitter.emit('notification.send', {
              orgId: widget.dashboard.organizationId,
              channel: 'in_app',
              recipient: 'admin',
              message: `🚨 ${alert.severity.toUpperCase()}: ${alert.message}\nWidget: ${widget.name}\nDashboard: ${widget.dashboard.name}`,
              params: { category: 'alert', severity: alert.severity },
              priority: alert.severity === 'critical' ? 10 : 5,
            });
          }

          await this.prisma.dashboardWidget.update({
            where: { id: widgetId },
            data: { lastAlertedAt: new Date() },
          });
        }
      }
    }

    return triggered;
  }

  private evaluateCondition(condition: string, data: any): boolean {
    try {
      // Parse condition like "value < 100" or "trend < -10"
      const parts = condition.match(/^(\w+)\s*(<|>|<=|>=|==|!=)\s*(-?[\d.]+)$/);
      if (!parts) return false;

      const [, field, operator, thresholdStr] = parts;
      const threshold = parseFloat(thresholdStr);
      const value = parseFloat(data[field]);

      if (isNaN(value)) return false;

      switch (operator) {
        case '<': return value < threshold;
        case '>': return value > threshold;
        case '<=': return value <= threshold;
        case '>=': return value >= threshold;
        case '==': return value === threshold;
        case '!=': return value !== threshold;
        default: return false;
      }
    } catch {
      return false;
    }
  }

  // =====================
  // Helpers (unchanged from original)
  // =====================

  private async getEntityDef(orgId: string, entityName?: string) {
    if (!entityName) return null;
    return this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: entityName },
    });
  }

  private buildFilters(orgId: string, entityDefId: string, config: WidgetConfig): any {
    const where: any = {
      organizationId: orgId,
      entityDefinitionId: entityDefId,
      status: 'active',
      deletedAt: null,
    };

    // Merge static filters with active cross-filters
    const allFilters = { ...(config.filters || {}), ...(config.activeFilters || {}) };

    if (Object.keys(allFilters).length > 0) {
      const conditions = Object.entries(allFilters).map(([key, value]) => ({
        data: { path: [key], string_contains: value },
      }));
      where.AND = conditions;
    }

    if (config.dateRange) {
      const dateFilter: any = {};
      if (config.dateRange.from) dateFilter.gte = new Date(config.dateRange.from);
      if (config.dateRange.to) dateFilter.lte = new Date(config.dateRange.to);
      if (config.dateRange.field === 'created_at') where.createdAt = dateFilter;
    }

    return where;
  }

  private getPreviousPeriodFilters(currentFilters: any, config: WidgetConfig): any {
    if (!config.dateRange) return { ...currentFilters };
    const from = config.dateRange.from ? new Date(config.dateRange.from) : new Date();
    const to = config.dateRange.to ? new Date(config.dateRange.to) : new Date();
    const duration = to.getTime() - from.getTime();
    const previousFrom = new Date(from.getTime() - duration);
    const previousTo = new Date(from.getTime());
    return { ...currentFilters, createdAt: { gte: previousFrom, lte: previousTo } };
  }

  private truncateDate(date: Date, interval: string): string {
    const d = new Date(date);
    switch (interval) {
      case 'week': d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0];
      case 'month': return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      default: return d.toISOString().split('T')[0];
    }
  }

  private extractTitle(data: any, field?: string): string {
    const d = data as Record<string, any>;
    if (field && d[field]) return String(d[field]);
    return `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name || 'Untitled';
  }

  private extractSubtitle(data: any): string {
    const d = data as Record<string, any>;
    return [d.district, d.nrc, d.email].filter(Boolean).join(' • ') || '';
  }
}