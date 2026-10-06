import { Controller, Get, Post, Query, Req } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AnomalyDetectorService } from './anomaly-detector.service';

@Controller('anomalies')
export class AnomalyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly anomalyDetector: AnomalyDetectorService,
  ) {}

  @Get()
  async getAnomalies(
    @Req() req: any,
    @Query('severity') severity?: string,
    @Query('anomalyType') anomalyType?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const where: any = { organizationId: orgId, suggestionType: 'anomaly' };
    if (severity) where.proposedAction = { path: ['severity'], equals: severity };
    if (anomalyType) where.proposedAction = { path: ['anomalyType'], equals: anomalyType };

    const [data, total] = await Promise.all([
      this.prisma.suggestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.suggestion.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  @Get('summary')
  async getSummary(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const anomalies = await this.prisma.suggestion.findMany({
      where: { organizationId: orgId, suggestionType: 'anomaly', status: 'pending' },
    });

    return {
      total: anomalies.length,
      critical: anomalies.filter(a => (a.proposedAction as any)?.severity === 'critical').length,
      high: anomalies.filter(a => (a.proposedAction as any)?.severity === 'high').length,
      medium: anomalies.filter(a => (a.proposedAction as any)?.severity === 'medium').length,
      low: anomalies.filter(a => (a.proposedAction as any)?.severity === 'low').length,
      byType: this.groupByType(anomalies),
    };
  }

  @Post('scan')
  async triggerScan(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const results = await this.anomalyDetector.scanOrganization(orgId);
    return { success: true, anomaliesFound: results.length };
  }

  private groupByType(anomalies: any[]) {
    const groups: Record<string, number> = {};
    for (const a of anomalies) {
      const type = (a.proposedAction as any)?.anomalyType || 'unknown';
      groups[type] = (groups[type] || 0) + 1;
    }
    return groups;
  }
}