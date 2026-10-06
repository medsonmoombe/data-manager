import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface AnomalyResult {
  recordId?: string;
  entityType: string;
  anomalyType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number;  // 0-100, higher = more suspicious
  evidence: Record<string, any>;
}

@Injectable()
export class AnomalyDetectorService {
  private readonly logger = new Logger(AnomalyDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Run full anomaly detection nightly.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runNightlyScan() {
    this.logger.log('Starting nightly anomaly scan...');

    const organizations = await this.prisma.organization.findMany({
      where: { isActive: true },
    });

    for (const org of organizations) {
      const anomalies = await this.scanOrganization(org.id);
      
      // Store as suggestions
      for (const anomaly of anomalies) {
        await this.createAnomalySuggestion(org.id, anomaly);
      }

      if (anomalies.length > 0) {
        this.eventEmitter.emit('alert.triggered', {
          orgId: org.id,
          message: `${anomalies.length} anomalies detected`,
          severity: anomalies.some(a => a.severity === 'critical') ? 'critical' : 'warning',
        });
      }
    }

    this.logger.log('Nightly anomaly scan complete');
  }

  /**
   * Run all anomaly checks for an organization.
   */
  async scanOrganization(orgId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    anomalies.push(...await this.benfordLawCheck(orgId));
    anomalies.push(...await this.duplicateDetectionCheck(orgId));
    anomalies.push(...await this.rapidChangeCheck(orgId));
    anomalies.push(...await this.unusualPatternCheck(orgId));
    anomalies.push(...await this.dataQualityAnomalies(orgId));

    return anomalies;
  }

  /**
   * Benford's Law: Detect fabricated numbers.
   * Real data follows Benford's distribution (first digit 1 appears 30% of the time).
   * Fabricated data often has uniform distribution.
   */
  private async benfordLawCheck(orgId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    // Get all numeric fields from golden records
    const records = await this.prisma.goldenRecord.findMany({
      where: { organizationId: orgId, status: 'active', deletedAt: null },
      select: { id: true, data: true, entityDefinition: { select: { name: true } } },
      take: 50000,
    });

    // Group by entity type
    const byEntity: Record<string, any[]> = {};
    for (const record of records) {
      const entityName = record.entityDefinition.name;
      if (!byEntity[entityName]) byEntity[entityName] = [];
      byEntity[entityName].push(record);
    }

    // Expected Benford distribution
    const benfordExpected = [0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046];

    for (const [entityName, entityRecords] of Object.entries(byEntity)) {
      if (entityRecords.length < 100) continue; // Need sufficient sample

      // Collect all numeric values
      const numericValues: number[] = [];
      for (const record of entityRecords) {
        const data = record.data as Record<string, any>;
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number' && value > 0) {
            numericValues.push(value);
          }
        }
      }

      if (numericValues.length < 100) continue;

      // Get first digits
      const firstDigits = numericValues.map((n) => {
        const str = String(Math.abs(n)).replace(/^0+/, '');
        return parseInt(str.charAt(0));
      });

      const digitCounts = new Array(10).fill(0);
      for (const d of firstDigits) {
        if (d >= 1 && d <= 9) digitCounts[d]++;
      }

      // Compare to Benford
      const total = firstDigits.length;
      let deviation = 0;
      for (let d = 1; d <= 9; d++) {
        const actual = digitCounts[d] / total;
        const expected = benfordExpected[d - 1];
        deviation += Math.abs(actual - expected);
      }

      // High deviation suggests fabricated data
      if (deviation > 0.3) {
        anomalies.push({
          entityType: entityName,
          anomalyType: 'benford_violation',
          severity: deviation > 0.5 ? 'high' : 'medium',
          description: `Numeric data in "${entityName}" deviates from Benford's Law (deviation: ${(deviation * 100).toFixed(1)}%). This may indicate fabricated or manipulated numbers.`,
          score: Math.min(100, Math.round(deviation * 100)),
          evidence: {
            entityName,
            sampleSize: total,
            deviation: (deviation * 100).toFixed(1) + '%',
            expectedDistribution: benfordExpected,
            actualDistribution: digitCounts.slice(1).map((c) => c / total),
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Duplicate Detection: Find records that are likely duplicates.
   */
  private async duplicateDetectionCheck(orgId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    const entityDefs = await this.prisma.entityDefinition.findMany({
      where: { organizationId: orgId },
    });

    for (const entityDef of entityDefs) {
      const records = await this.prisma.goldenRecord.findMany({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          status: 'active',
          deletedAt: null,
        },
        select: { id: true, data: true, hashedIdentifier: true },
      });

      // Check for records with same hashed identifier
      const byHash = new Map<string, string[]>();
      for (const record of records) {
        if (record.hashedIdentifier) {
          const existing = byHash.get(record.hashedIdentifier) || [];
          existing.push(record.id);
          byHash.set(record.hashedIdentifier, existing);
        }
      }

      for (const [hash, ids] of byHash) {
        if (ids.length > 1) {
          anomalies.push({
            entityType: entityDef.name,
            anomalyType: 'duplicate_identifier',
            severity: 'critical',
            description: `${ids.length} records in "${entityDef.name}" share the same identifier. These are likely duplicates requiring immediate merge.`,
            score: 95,
            evidence: {
              entityName: entityDef.name,
              recordIds: ids,
              duplicateCount: ids.length,
            },
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Rapid Change Detection: Flag entities with unusually high activity.
   */
  private async rapidChangeCheck(orgId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    // Check for record update velocity
    const recentUpdates = await this.prisma.activityEvent.groupBy({
      by: ['entityId', 'entityType'],
      where: {
        organizationId: orgId,
        eventType: 'record_updated',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      _count: { id: true },
      having: { id: { _count: { gt: 5 } } }, // More than 5 updates in 24h
    });

    for (const update of recentUpdates) {
      if (update.entityId && update._count.id > 10) {
        anomalies.push({
          recordId: update.entityId,
          entityType: update.entityType || 'unknown',
          anomalyType: 'rapid_changes',
          severity: update._count.id > 20 ? 'high' : 'medium',
          description: `Record updated ${update._count.id} times in 24 hours. Possible data tampering or system error.`,
          score: Math.min(100, update._count.id * 5),
          evidence: {
            updateCount: update._count.id,
            period: '24 hours',
          },
        });
      }
    }

    // Check for rapid record creation from same actor
    const rapidCreators = await this.prisma.activityEvent.groupBy({
      by: ['actorUserId'],
      where: {
        organizationId: orgId,
        eventType: 'record_created',
        createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
      },
      _count: { id: true },
      having: { id: { _count: { gt: 20 } } }, // More than 20 creations in 1 hour
    });

    for (const creator of rapidCreators) {
      if (creator.actorUserId) {
        anomalies.push({
          entityType: 'user_activity',
          anomalyType: 'rapid_creation',
          severity: 'medium',
          description: `User created ${creator._count.id} records in 1 hour. Verify this is legitimate bulk data entry.`,
          score: Math.min(100, creator._count.id * 3),
          evidence: {
            userId: creator.actorUserId,
            creationCount: creator._count.id,
            period: '1 hour',
          },
        });
      }
    }

    return anomalies;
  }

  /**
   * Unusual Pattern Detection: Find statistical outliers.
   */
  private async unusualPatternCheck(orgId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    // Check each entity type for numeric field outliers
    const entityDefs = await this.prisma.entityDefinition.findMany({
      where: { organizationId: orgId },
    });

    for (const entityDef of entityDefs) {
      const records = await this.prisma.goldenRecord.findMany({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          status: 'active',
          deletedAt: null,
        },
        select: { id: true, data: true },
        take: 10000,
      });

      if (records.length < 30) continue; // Need sufficient sample

      // Find numeric fields
      const numericFields = new Set<string>();
      for (const record of records.slice(0, 100)) {
        const data = record.data as Record<string, any>;
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'number') numericFields.add(key);
        }
      }

      // For each numeric field, detect outliers using IQR
      for (const field of numericFields) {
        const values: { id: string; value: number }[] = [];

        for (const record of records) {
          const data = record.data as Record<string, any>;
          if (typeof data[field] === 'number') {
            values.push({ id: record.id, value: data[field] });
          }
        }

        if (values.length < 30) continue;

        // Calculate IQR
        const sorted = values.map((v) => v.value).sort((a, b) => a - b);
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const q1 = sorted[q1Index];
        const q3 = sorted[q3Index];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;

        // Find outliers
        const outliers = values.filter((v) => v.value < lowerBound || v.value > upperBound);

        for (const outlier of outliers.slice(0, 10)) { // Limit to 10 per field
          const zScore = Math.abs((outlier.value - (q1 + q3) / 2) / (iqr || 1));
          anomalies.push({
            recordId: outlier.id,
            entityType: entityDef.name,
            anomalyType: 'statistical_outlier',
            severity: zScore > 3 ? 'high' : 'medium',
            description: `"${field}" value (${outlier.value}) is a statistical outlier for "${entityDef.name}". Expected range: ${Math.round(lowerBound)} - ${Math.round(upperBound)}.`,
            score: Math.min(100, Math.round(zScore * 20)),
            evidence: {
              field,
              value: outlier.value,
              expectedRange: `${Math.round(lowerBound)} - ${Math.round(upperBound)}`,
              zScore: zScore.toFixed(2),
            },
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Data Quality Anomalies: Track validation issue trends.
   */
  private async dataQualityAnomalies(orgId: string): Promise<AnomalyResult[]> {
    const anomalies: AnomalyResult[] = [];

    // Check if validation issues are increasing
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const currentWeek = await this.prisma.validationResult.count({
      where: {
        rule: { organizationId: orgId },
        createdAt: { gte: weekAgo },
      },
    });

    const previousWeek = await this.prisma.validationResult.count({
      where: {
        rule: { organizationId: orgId },
        createdAt: { gte: twoWeeksAgo, lt: weekAgo },
      },
    });

    if (previousWeek > 10 && currentWeek > previousWeek * 1.5) {
      const increase = Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
      anomalies.push({
        entityType: 'data_quality',
        anomalyType: 'quality_decline',
        severity: increase > 100 ? 'high' : 'medium',
        description: `Validation issues increased by ${increase}% this week (${previousWeek} → ${currentWeek}). Data quality may be declining.`,
        score: Math.min(100, increase),
        evidence: {
          currentWeek,
          previousWeek,
          percentIncrease: increase,
        },
      });
    }

    return anomalies;
  }

  /**
   * Create a suggestion from an anomaly.
   */
  private async createAnomalySuggestion(orgId: string, anomaly: AnomalyResult) {
    await this.prisma.suggestion.create({
      data: {
        organizationId: orgId,
        suggestionType: 'anomaly',
        title: anomaly.description.substring(0, 200),
        description: `Score: ${anomaly.score}/100 | Type: ${anomaly.anomalyType}`,
        entityTypeA: anomaly.entityType,
        entityIdA: anomaly.recordId || '',
        proposedAction: {
          action: 'investigate_anomaly',
          anomalyType: anomaly.anomalyType,
          severity: anomaly.severity,
          score: anomaly.score,
          evidence: anomaly.evidence,
        },
        confidence: anomaly.score / 100,
      },
    });
  }
}