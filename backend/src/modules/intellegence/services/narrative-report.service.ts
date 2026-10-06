import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

interface MetricChange {
  metric: string;
  currentValue: number;
  previousValue: number;
  percentChange: number;
  direction: 'up' | 'down' | 'flat';
  significance: 'high' | 'medium' | 'low';
}

interface Anomaly {
  entity: string;
  field: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'warning' | 'critical';
  description: string;
}

@Injectable()
export class NarrativeReportService {
  private readonly logger = new Logger(NarrativeReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a narrative report for an organization.
   */
  async generateReport(orgId: string, period: 'week' | 'month' | 'quarter' = 'month'): Promise<any> {
    const periods = this.calculatePeriods(period);
    
    const [metrics, anomalies, topContributors, dataQuality] = await Promise.all([
      this.calculateMetrics(orgId, periods),
      this.detectAnomalies(orgId, periods),
      this.findTopContributors(orgId, periods),
      this.getDataQualityScore(orgId),
    ]);

    const narrative = this.buildNarrative(metrics, anomalies, topContributors, dataQuality, period);
    const summary = this.buildSummary(metrics);

    return {
      generatedAt: new Date().toISOString(),
      period: periods.label,
      summary,
      narrative,
      metrics,
      anomalies,
      topContributors,
      dataQuality,
    };
  }

  private calculatePeriods(period: string) {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;
    let label: string;

    switch (period) {
      case 'week':
        currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        label = 'week';
        break;
      case 'quarter':
        currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        label = 'quarter';
        break;
      case 'month':
      default:
        currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        previousEnd = currentStart;
        label = 'month';
    }

    return { currentStart, previousStart, previousEnd, label };
  }

  private async calculateMetrics(orgId: string, periods: any): Promise<MetricChange[]> {
    const metrics: MetricChange[] = [];

    // Total records
    const currentTotal = await this.prisma.goldenRecord.count({
      where: { organizationId: orgId, status: 'active', createdAt: { gte: periods.currentStart } },
    });
    const previousTotal = await this.prisma.goldenRecord.count({
      where: { organizationId: orgId, status: 'active', createdAt: { gte: periods.previousStart, lt: periods.previousEnd } },
    });

    metrics.push(this.buildMetric('Total Records', currentTotal, previousTotal));

    // Form submissions
    const currentForms = await this.prisma.formSubmission.count({
      where: { organizationId: orgId, submittedAt: { gte: periods.currentStart } },
    });
    const previousForms = await this.prisma.formSubmission.count({
      where: { organizationId: orgId, submittedAt: { gte: periods.previousStart, lt: periods.previousEnd } },
    });

    metrics.push(this.buildMetric('Form Submissions', currentForms, previousForms));

    // Relationships created
    const currentRels = await this.prisma.recordRelationship.count({
      where: { organizationId: orgId, createdAt: { gte: periods.currentStart } },
    });
    const previousRels = await this.prisma.recordRelationship.count({
      where: { organizationId: orgId, createdAt: { gte: periods.previousStart, lt: periods.previousEnd } },
    });

    metrics.push(this.buildMetric('Relationships Created', currentRels, previousRels));

    // Suggestions resolved
    const currentSuggestions = await this.prisma.suggestion.count({
      where: { organizationId: orgId, status: { in: ['accepted', 'rejected'] }, resolvedAt: { gte: periods.currentStart } },
    });
    const previousSuggestions = await this.prisma.suggestion.count({
      where: { organizationId: orgId, status: { in: ['accepted', 'rejected'] }, resolvedAt: { gte: periods.previousStart, lt: periods.previousEnd } },
    });

    metrics.push(this.buildMetric('Suggestions Resolved', currentSuggestions, previousSuggestions));

    return metrics;
  }

  private buildMetric(name: string, current: number, previous: number): MetricChange {
    const percentChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 100;
    return {
      metric: name,
      currentValue: current,
      previousValue: previous,
      percentChange,
      direction: percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'flat',
      significance: Math.abs(percentChange) > 20 ? 'high' : Math.abs(percentChange) > 10 ? 'medium' : 'low',
    };
  }

  private async detectAnomalies(orgId: string, periods: any): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Check for entities with unusually high/low growth
    const entityDefs = await this.prisma.entityDefinition.findMany({
      where: { organizationId: orgId },
    });

    for (const entityDef of entityDefs) {
      const currentCount = await this.prisma.goldenRecord.count({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          status: 'active',
          createdAt: { gte: periods.currentStart },
        },
      });

      const previousCount = await this.prisma.goldenRecord.count({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          status: 'active',
          createdAt: { gte: periods.previousStart, lt: periods.previousEnd },
        },
      });

      if (previousCount > 10) {
        const percentChange = ((currentCount - previousCount) / previousCount) * 100;

        if (percentChange > 50) {
          anomalies.push({
            entity: entityDef.name,
            field: 'total_count',
            value: currentCount,
            expectedValue: previousCount,
            deviation: percentChange,
            severity: 'warning',
            description: `${entityDef.name} records increased by ${Math.round(percentChange)}% — significantly above normal`,
          });
        } else if (percentChange < -30) {
          anomalies.push({
            entity: entityDef.name,
            field: 'total_count',
            value: currentCount,
            expectedValue: previousCount,
            deviation: percentChange,
            severity: 'critical',
            description: `${entityDef.name} records decreased by ${Math.round(Math.abs(percentChange))}% — investigation recommended`,
          });
        }
      }
    }

    // Check for spike in validation issues
    const currentIssues = await this.prisma.validationResult.count({
      where: { status: 'open', createdAt: { gte: periods.currentStart } },
    });
    const previousIssues = await this.prisma.validationResult.count({
      where: { status: 'open', createdAt: { gte: periods.previousStart, lt: periods.previousEnd } },
    });

    if (previousIssues > 0 && currentIssues > previousIssues * 1.5) {
      anomalies.push({
        entity: 'validation',
        field: 'open_issues',
        value: currentIssues,
        expectedValue: previousIssues,
        deviation: ((currentIssues - previousIssues) / previousIssues) * 100,
        severity: 'warning',
        description: `Open validation issues spiked from ${previousIssues} to ${currentIssues} — data quality may be declining`,
      });
    }

    return anomalies;
  }

  private async findTopContributors(orgId: string, periods: any): Promise<any[]> {
    // Find entities with most records created
    const topEntities = await this.prisma.goldenRecord.groupBy({
      by: ['entityDefinitionId'],
      where: {
        organizationId: orgId,
        status: 'active',
        createdAt: { gte: periods.currentStart },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const contributors = [];
    for (const entity of topEntities) {
      const entityDef = await this.prisma.entityDefinition.findUnique({
        where: { id: entity.entityDefinitionId },
        select: { name: true },
      });
      contributors.push({
        name: entityDef?.name || 'Unknown',
        count: entity._count.id,
      });
    }

    return contributors;
  }

  private async getDataQualityScore(orgId: string): Promise<any> {
    const [totalRules, openIssues, fixedIssues] = await Promise.all([
      this.prisma.validationRule.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.validationResult.count({ where: { rule: { organizationId: orgId }, status: 'open' } }),
      this.prisma.validationResult.count({ where: { rule: { organizationId: orgId }, status: 'fixed' } }),
    ]);

    const score = totalRules > 0 ? Math.round((1 - openIssues / (openIssues + fixedIssues + 1)) * 100) : 100;

    return { score, totalRules, openIssues, fixedIssues };
  }

  private buildNarrative(
    metrics: MetricChange[],
    anomalies: Anomaly[],
    topContributors: any[],
    dataQuality: any,
    period: string,
  ): string {
    const paragraphs: string[] = [];

    // Opening summary
    const significantChanges = metrics.filter((m) => m.significance === 'high');
    if (significantChanges.length > 0) {
      const changes = significantChanges.map((m) =>
        `${m.metric} ${m.direction === 'up' ? 'increased' : 'decreased'} by ${Math.abs(m.percentChange)}%`
      ).join(', ');
      paragraphs.push(`This ${period} saw significant changes: ${changes}.`);
    } else {
      paragraphs.push(`This ${period}, all key metrics remained within expected ranges.`);
    }

    // Top contributors
    if (topContributors.length > 0) {
      const topList = topContributors.map((t) => `${t.name} (${t.count})`).join(', ');
      paragraphs.push(`The top contributing entities were: ${topList}.`);
    }

    // Anomalies
    if (anomalies.length > 0) {
      for (const anomaly of anomalies) {
        paragraphs.push(`⚠️ ${anomaly.severity.toUpperCase()}: ${anomaly.description}.`);
      }
    } else {
      paragraphs.push(`No anomalies were detected this ${period}.`);
    }

    // Data quality
    paragraphs.push(`Data quality score: ${dataQuality.score}%. There are ${dataQuality.openIssues} open validation issues requiring attention.`);

    // Closing
    paragraphs.push(`Report generated automatically by OmniCore Africa on ${new Date().toLocaleDateString('en-ZM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`);

    return paragraphs.join('\n\n');
  }

  private buildSummary(metrics: MetricChange[]): string {
    const highlights = metrics
      .filter((m) => m.significance !== 'low')
      .map((m) => `${m.metric}: ${m.direction === 'up' ? '↑' : '↓'} ${Math.abs(m.percentChange)}%`)
      .join(' | ');

    return highlights || 'All metrics stable';
  }
}