import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

interface EntityField {
  name: string;
  dataType: string;
  isIdentifier: boolean;
  weight: number;
}

@Injectable()
export class DuplicateDetectorService {
  private readonly logger = new Logger(DuplicateDetectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startScan(orgId: string, entityName?: string): Promise<string> {
    const job = await this.prisma.duplicateScanJob.create({
      data: { organizationId: orgId, entityName: entityName || 'all', status: 'pending' },
    });

    this.runScanAsync(job.id, orgId, entityName).catch((err) => {
      this.logger.error(`Scan failed: ${err.message}`);
    });

    return job.id;
  }

  async getScanProgress(jobId: string) {
    const job = await this.prisma.duplicateScanJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    const percentage = job.totalPairs > 0 ? Math.round((job.processedPairs / job.totalPairs) * 100) : 0;

    return {
      jobId: job.id,
      status: job.status,
      percentage,
      processedPairs: job.processedPairs,
      totalPairs: job.totalPairs,
      duplicatesFound: job.duplicatesFound,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
      estimatedRemainingMs: this.calculateEstimate(job),
    };
  }

  private calculateEstimate(job: any): number | null {
    if (job.status !== 'running' || job.processedPairs === 0) return null;
    const elapsed = Date.now() - new Date(job.startedAt).getTime();
    const remaining = job.totalPairs - job.processedPairs;
    const msPerPair = elapsed / job.processedPairs;
    return Math.round(msPerPair * remaining);
  }

  private async runScanAsync(jobId: string, orgId: string, entityName?: string) {
    try {
      await this.prisma.duplicateScanJob.update({
        where: { id: jobId },
        data: { status: 'running', startedAt: new Date() },
      });

      const where: any = { organizationId: orgId };
      if (entityName && entityName !== 'all') where.name = entityName;

      const entityDefs = await this.prisma.entityDefinition.findMany({
        where,
        include: { attributes: true },
      });

      let totalDuplicates = 0;

      for (const entityDef of entityDefs) {
        const found = await this.scanEntityWithProgress(jobId, orgId, entityDef.id, entityDef.name, entityDef.attributes);
        totalDuplicates += found;
      }

      await this.prisma.duplicateScanJob.update({
        where: { id: jobId },
        data: { status: 'completed', completedAt: new Date(), duplicatesFound: totalDuplicates },
      });
    } catch (error: any) {
      await this.prisma.duplicateScanJob.update({
        where: { id: jobId },
        data: { status: 'failed', completedAt: new Date(), errorMessage: error.message },
      });
    }
  }

  private async scanEntityWithProgress(
    jobId: string,
    orgId: string,
    entityDefId: string,
    entityName: string,
    attributes: any[],
  ): Promise<number> {
    const records = await this.prisma.goldenRecord.findMany({
      where: { organizationId: orgId, entityDefinitionId: entityDefId, status: 'active', deletedAt: null },
    });

    if (records.length < 2) return 0;

    const identifierFields = attributes.filter((a: any) => a.isIdentifier);
    const otherFields = attributes.filter((a: any) => !a.isIdentifier);

    const weightedFields: EntityField[] = [
      ...identifierFields.map((f: any) => ({ name: f.name, dataType: f.dataType, isIdentifier: true, weight: 0.6 / (identifierFields.length || 1) })),
      ...otherFields.map((f: any) => ({ name: f.name, dataType: f.dataType, isIdentifier: false, weight: 0.4 / (otherFields.length || 1) })),
    ];

    const blocks = new Map<string, any[]>();
    for (const record of records) {
      if (record.hashedIdentifier) {
        const blockKey = record.hashedIdentifier.substring(0, 8);
        if (!blocks.has(blockKey)) blocks.set(blockKey, []);
        blocks.get(blockKey)!.push(record);
      } else {
        if (!blocks.has('_default')) blocks.set('_default', []);
        blocks.get('_default')!.push(record);
      }
    }

    let duplicatesFound = 0;
    let totalProcessed = 0;
    let totalPairs = 0;

    for (const block of blocks.values()) {
      totalPairs += (block.length * (block.length - 1)) / 2;
    }

    await this.prisma.duplicateScanJob.update({
      where: { id: jobId },
      data: { totalPairs, totalRecords: records.length },
    });

    for (const block of blocks.values()) {
      for (let i = 0; i < block.length; i++) {
        for (let j = i + 1; j < block.length; j++) {
          totalProcessed++;

          if (totalProcessed % 1000 === 0) {
            await this.prisma.duplicateScanJob.update({
              where: { id: jobId },
              data: { processedPairs: totalProcessed },
            });
          }

          const sourceData = block[i].data as Record<string, any>;
          const targetData = block[j].data as Record<string, any>;
          const confidence = this.calculateConfidence(sourceData, targetData, weightedFields);

          if (confidence >= 0.7) {
            await this.createDuplicateSuggestion([block[i].id, block[j].id], confidence, entityDefId, orgId);
            duplicatesFound++;
          }
        }
      }
    }

    await this.prisma.duplicateScanJob.update({
      where: { id: jobId },
      data: { processedPairs: totalProcessed, duplicatesFound },
    });

    return duplicatesFound;
  }

  private calculateConfidence(source: Record<string, any>, target: Record<string, any>, fields: EntityField[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const field of fields) {
      const sv = source[field.name];
      const tv = target[field.name];

      if (sv === undefined && tv === undefined) continue;
      totalWeight += field.weight;

      if (sv === undefined || tv === undefined) {
        totalScore += field.weight * 0.3;
        continue;
      }

      totalScore += field.weight * this.compareValues(sv, tv, field.dataType);
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private compareValues(a: any, b: any, dataType: string): number {
    if (a === b) return 1.0;
    const strA = String(a).toLowerCase().trim();
    const strB = String(b).toLowerCase().trim();

    switch (dataType) {
      case 'string':
      case 'text':
        if (strA === strB) return 1.0;
        if (strA.includes(strB) || strB.includes(strA)) return 0.8;
        const wordsA = new Set(strA.split(/\s+/));
        const wordsB = new Set(strB.split(/\s+/));
        const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
        const union = wordsA.size + wordsB.size - intersection;
        return union > 0 ? intersection / union : 0;
      case 'number':
        const numA = Number(a);
        const numB = Number(b);
        if (isNaN(numA) || isNaN(numB)) return 0;
        const diff = Math.abs(numA - numB);
        const max = Math.max(Math.abs(numA), Math.abs(numB));
        return max > 0 ? Math.max(0, 1 - diff / max) : 1;
      case 'date':
        const dateA = new Date(a);
        const dateB = new Date(b);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateA.toDateString() === dateB.toDateString() ? 1.0 : 0.5;
      default:
        return strA === strB ? 1.0 : 0;
    }
  }

  private async createDuplicateSuggestion(recordIds: string[], confidence: number, entityDefId: string, orgId: string) {
    const existing = await this.prisma.suggestion.findFirst({
      where: {
        organizationId: orgId,
        suggestionType: 'merge',
        status: 'pending',
        entityIdA: recordIds[0],
        entityIdB: recordIds[1],
      },
    });

    if (existing) return;

    await this.prisma.suggestion.create({
      data: {
        organizationId: orgId,
        suggestionType: 'merge',
        title: 'Possible duplicate records',
        description: `${recordIds.length} records with ${Math.round(confidence * 100)}% confidence`,
        entityTypeA: 'golden_record',
        entityIdA: recordIds[0],
        entityTypeB: 'golden_record',
        entityIdB: recordIds[1],
        proposedAction: { action: 'merge_records', records: recordIds.map(id => ({ id })), entityDefinitionId: entityDefId },
        confidence,
      },
    });
  }

  async mergeDuplicates(suggestionId: string, userId?: string) {
    const suggestion = await this.prisma.suggestion.findUnique({ where: { id: suggestionId } });
    if (!suggestion) throw new Error('Suggestion not found');
    // Allow re-processing if records are still active (handles UI retry)
    if (suggestion.status === 'rejected') throw new Error('Suggestion was rejected');

    const action = suggestion.proposedAction as any;

    // Handle both formats: recordIds (legacy) and records (current)
    let recordIds: string[];
    if (action.recordIds) {
      recordIds = action.recordIds;
    } else if (action.records) {
      recordIds = action.records.map((r: any) => r.id ?? r);
    } else {
      throw new Error('No records found in suggestion');
    }

    if (recordIds.length < 2) throw new Error('Not enough records to merge');

    // Only pick active records — never reuse a previously merged record as master
    const goldenRecords = await this.prisma.goldenRecord.findMany({
      where: { id: { in: recordIds }, status: 'active', deletedAt: null },
    });

    if (goldenRecords.length === 0) {
      // All records already merged — just mark suggestion as accepted and return
      await this.prisma.suggestion.update({
        where: { id: suggestionId },
        data: { status: 'accepted', resolvedBy: userId, resolvedAt: new Date() },
      });
      return { success: true, masterRecordId: null, mergedCount: 0, mergedRecordIds: [], message: 'Records were already merged' };
    }

    if (goldenRecords.length === 1) {
      // Only one active record remains — duplicate was already merged elsewhere
      await this.prisma.suggestion.update({
        where: { id: suggestionId },
        data: { status: 'accepted', resolvedBy: userId, resolvedAt: new Date() },
      });
      return { success: true, masterRecordId: goldenRecords[0].id, mergedCount: 0, mergedRecordIds: [], message: 'Duplicate already resolved' };
    }

    // Pick master by most complete data
    const sorted = goldenRecords.sort((a, b) => Object.keys(b.data as any).length - Object.keys(a.data as any).length);
    const masterRecord = sorted[0];
    const otherRecords = sorted.slice(1);
    const masterData = masterRecord.data as Record<string, any>;
    const orgId = masterRecord.organizationId;

    // Merge data from other records into master
    for (const record of otherRecords) {
      const recordData = record.data as Record<string, any>;
      for (const [key, value] of Object.entries(recordData)) {
        const current = masterData[key];
        if ((current === undefined || current === null || current === '') && value !== undefined && value !== null && value !== '') {
          masterData[key] = value;
        }
      }
    }

    // Transfer relationships
    const entityDef = await this.prisma.entityDefinition.findUnique({
      where: { id: masterRecord.entityDefinitionId },
    });

    if (entityDef) {
      const entityName = entityDef.name;

      for (const record of otherRecords) {
        await this.prisma.recordRelationship.updateMany({
          where: { organizationId: orgId, targetEntityType: entityName, targetRecordId: record.id },
          data: { targetRecordId: masterRecord.id },
        });
        await this.prisma.recordRelationship.updateMany({
          where: { organizationId: orgId, sourceEntityType: entityName, sourceRecordId: record.id },
          data: { sourceRecordId: masterRecord.id },
        });
      }
    }

    // Create a new version for the master record
    const versionCount = await this.prisma.recordVersion.count({
      where: { goldenRecordId: masterRecord.id },
    });

    await this.prisma.recordVersion.create({
      data: {
        goldenRecordId: masterRecord.id,
        versionNumber: versionCount + 1,
        dataSnapshot: masterData,
        changedFields: Object.keys(masterData),
        updatedBy: userId,
      },
    });

    // Update master record with merged data
    await this.prisma.goldenRecord.update({
      where: { id: masterRecord.id },
      data: { data: masterData, updatedBy: userId, updatedAt: new Date() },
    });

    // Mark other records as merged
    for (const record of otherRecords) {
      await this.prisma.goldenRecord.update({
        where: { id: record.id },
        data: { status: 'merged', deletedAt: new Date(), updatedBy: userId },
      });
      await this.prisma.mergeHistory.create({
        data: {
          entityDefinitionId: masterRecord.entityDefinitionId,
          survivingRecordId: masterRecord.id,
          mergedRecordId: record.id,
          mergedBy: userId,
        },
      });
    }

    // Mark suggestion as accepted
    await this.prisma.suggestion.update({
      where: { id: suggestionId },
      data: { status: 'accepted', resolvedBy: userId, resolvedAt: new Date() },
    });

    // Emit event for timeline
    this.eventEmitter.emit('golden_record.updated', {
      orgId,
      recordId: masterRecord.id,
      entityType: entityDef?.name || 'unknown',
      changedFields: Object.keys(masterData),
      userId,
    });

    this.logger.log(`Merged ${otherRecords.length} records into ${masterRecord.id}`);

    return {
      success: true,
      masterRecordId: masterRecord.id,
      mergedCount: otherRecords.length,
      mergedRecordIds: otherRecords.map(r => r.id),
    };
  }

  async getPendingDuplicates(orgId: string) {
    const suggestions = await this.prisma.suggestion.findMany({
      where: { organizationId: orgId, suggestionType: 'merge', status: 'pending' },
      orderBy: { confidence: 'desc' },
      take: 100,
    });

    // Filter out suggestions where either record has already been merged/deleted
    const filtered: typeof suggestions = [];
    for (const s of suggestions) {
      const action = s.proposedAction as any;
      const recordIds: string[] = action.recordIds
        ?? (action.records ?? []).map((r: any) => r.id ?? r);

      if (!recordIds.length) continue;

      const activeCount = await this.prisma.goldenRecord.count({
        where: { id: { in: recordIds }, status: 'active', deletedAt: null },
      });

      if (activeCount >= 2) {
        filtered.push(s);
      } else {
        // Auto-resolve stale suggestion so it doesn't clog the list
        await this.prisma.suggestion.update({
          where: { id: s.id },
          data: { status: 'accepted', resolvedAt: new Date() },
        });
      }
    }

    return filtered;
  }

  async getDuplicateSummary(orgId: string) {
    const pending = await this.prisma.suggestion.count({
      where: { organizationId: orgId, suggestionType: 'merge', status: 'pending' },
    });
    const resolved = await this.prisma.suggestion.count({
      where: { organizationId: orgId, suggestionType: 'merge', status: { in: ['accepted', 'rejected'] } },
    });
    const lastJob = await this.prisma.duplicateScanJob.findFirst({
      where: { organizationId: orgId },
      orderBy: { startedAt: 'desc' },
    });

    return {
      totalDuplicatesFound: pending,
      pendingMerges: pending,
      resolvedMerges: resolved,
      lastScan: lastJob?.completedAt || null,
      lastScanStatus: lastJob?.status || null,
    };
  }
}
