import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class MatchingEngineService {
  private readonly logger = new Logger(MatchingEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate a hashed identifier for encrypted search.
   */
  hashIdentifier(value: string): string {
    return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
  }

  /**
   * Calculate Jaro-Winkler similarity between two strings (0 to 1).
   * Simple implementation — can be replaced with a library later.
   */
  private stringSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0.0;

    const s1 = a.toLowerCase().trim();
    const s2 = b.toLowerCase().trim();

    // Exact match shortcut
    if (s1 === s2) return 1.0;

    // Simple character overlap ratio
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (shorter.length === 0) return 0.0;

    let matches = 0;
    const shorterChars = shorter.split('');
    const longerChars = longer.split('');

    for (const char of shorterChars) {
      const index = longerChars.indexOf(char);
      if (index !== -1) {
        matches++;
        longerChars.splice(index, 1); // Remove matched char
      }
    }

    return matches / shorter.length;
  }

  /**
   * Score a source record against a golden record using matching rules.
   */
  private calculateMatchScore(
    sourceData: Record<string, any>,
    goldenData: Record<string, any>,
    fieldWeights: Record<string, number>,
  ): number {
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [field, weight] of Object.entries(fieldWeights)) {
      totalWeight += weight;
      const sourceValue = sourceData[field];
      const goldenValue = goldenData[field];

      if (sourceValue && goldenValue) {
        const similarity = this.stringSimilarity(String(sourceValue), String(goldenValue));
        weightedScore += similarity * weight;
      }
    }

    if (totalWeight === 0) return 0;
    return weightedScore / totalWeight;
  }

  /**
   * Find or create a golden record for a source record.
   * Returns the matched (or newly created) golden record ID.
   */
  async matchSourceRecord(
    sourceRecordId: string,
    organizationId: string,
  ): Promise<string | null> {
    // 1. Get the source record
    const sourceRecord = await this.prisma.sourceRecord.findUnique({
      where: { id: sourceRecordId },
    });

    if (!sourceRecord) {
      this.logger.warn(`Source record not found: ${sourceRecordId}`);
      return null;
    }

    const sourceData = sourceRecord.sourceData as Record<string, any>;
    const entityDefId = sourceRecord.entityDefinitionId;

    // 2. Get active matching rules for this entity
    const rules = await this.prisma.matchingRule.findMany({
      where: {
        entityDefinitionId: entityDefId,
        isActive: true,
      },
    });

    if (rules.length === 0) {
      // No rules: create a new golden record for every source record
      return this.createNewGoldenRecord(sourceRecordId, sourceData, organizationId, entityDefId);
    }

    // 3. Build hashed identifier for blocking (exact NRC match)
    const identifierFields = await this.prisma.entityAttribute.findMany({
      where: {
        entityDefinitionId: entityDefId,
        isIdentifier: true,
      },
    });

    let hashedId: string | null = null;
    if (identifierFields.length > 0) {
      const idValue = sourceData[identifierFields[0].name];
      if (idValue) {
        hashedId = this.hashIdentifier(String(idValue));
      }
    }

    // 4. Find candidate golden records
    let candidates: any[] = [];

    if (hashedId) {
      // Exact match on hashed identifier
      candidates = await this.prisma.goldenRecord.findMany({
        where: {
          organizationId,
          entityDefinitionId: entityDefId,
          hashedIdentifier: hashedId,
          status: 'active',
        },
      });
    }

    // If no candidates by identifier, get recent active records as candidates
    if (candidates.length === 0) {
      candidates = await this.prisma.goldenRecord.findMany({
        where: {
          organizationId,
          entityDefinitionId: entityDefId,
          status: 'active',
        },
        orderBy: { updatedAt: 'desc' },
        take: 100, // Limit to avoid full table scan
      });
    }

    // 5. Score candidates
    let bestMatch: { id: string; score: number } | null = null;
    const rule = rules[0]; // Use the first active rule
    const fieldWeights = rule.fieldWeights as Record<string, number>;

    for (const candidate of candidates) {
      const score = this.calculateMatchScore(
        sourceData,
        candidate.data as Record<string, any>,
        fieldWeights,
      );

      if (score >= rule.threshold) {
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { id: candidate.id, score };
        }
      }
    }

    // 6. If match found, link; otherwise create new golden record
    if (bestMatch) {
      this.logger.debug(`Matched to golden record ${bestMatch.id} with score ${bestMatch.score}`);
      return this.linkToGoldenRecord(sourceRecordId, bestMatch.id, bestMatch.score, organizationId);
    } else {
      this.logger.debug('No match found, creating new golden record');
      return this.createNewGoldenRecord(sourceRecordId, sourceData, organizationId, entityDefId);
    }
  }

  /**
   * Create a new golden record from a source record.
   */
  private async createNewGoldenRecord(
    sourceRecordId: string,
    sourceData: Record<string, any>,
    organizationId: string,
    entityDefinitionId: string,
  ): Promise<string> {
    // Generate hashed identifier
    const identifierFields = await this.prisma.entityAttribute.findMany({
      where: { entityDefinitionId, isIdentifier: true },
    });

    let hashedId: string | null = null;
    if (identifierFields.length > 0) {
      const idValue = sourceData[identifierFields[0].name];
      if (idValue) {
        hashedId = this.hashIdentifier(String(idValue));
      }
    }

    // Create golden record
    const goldenRecord = await this.prisma.goldenRecord.create({
      data: {
        entityDefinitionId,
        organizationId,
        data: sourceData,
        hashedIdentifier: hashedId,
        matchConfidence: 1.0,
        status: 'active',
      },
    });

    // Create version 1
    await this.prisma.recordVersion.create({
      data: {
        goldenRecordId: goldenRecord.id,
        versionNumber: 1,
        dataSnapshot: sourceData,
        changedFields: Object.keys(sourceData),
      },
    });

    // Link source record
    await this.prisma.sourceRecord.update({
      where: { id: sourceRecordId },
      data: {
        goldenRecordId: goldenRecord.id,
        status: 'matched',
      },
    });

    this.eventEmitter.emit('golden_record.created', {
      orgId: organizationId,
      recordId: goldenRecord.id,
      entityType: 'golden_record',
      data: sourceData,
    });

    return goldenRecord.id;
  }

  /**
   * Link a source record to an existing golden record.
   * Updates the golden record data if new fields are present.
   */
  private async linkToGoldenRecord(
    sourceRecordId: string,
    goldenRecordId: string,
    confidence: number,
    organizationId: string,
  ): Promise<string> {
    const sourceRecord = await this.prisma.sourceRecord.findUnique({
      where: { id: sourceRecordId },
    });

    const goldenRecord = await this.prisma.goldenRecord.findUnique({
      where: { id: goldenRecordId },
    });

    if (!sourceRecord || !goldenRecord) return goldenRecordId;

    const sourceData = sourceRecord.sourceData as Record<string, any>;
    const existingData = goldenRecord.data as Record<string, any>;
    const mergedData = { ...existingData };
    const changedFields: string[] = [];

    // Merge: new fields from source are added if not already present
    for (const [key, value] of Object.entries(sourceData)) {
      if (!(key in mergedData) || mergedData[key] === null || mergedData[key] === '') {
        if (value !== null && value !== undefined && value !== '') {
          mergedData[key] = value;
          changedFields.push(key);
        }
      }
    }

    // Update golden record if there are changes
    if (changedFields.length > 0) {
      const versionCount = await this.prisma.recordVersion.count({
        where: { goldenRecordId },
      });

      await this.prisma.goldenRecord.update({
        where: { id: goldenRecordId },
        data: {
          data: mergedData,
          matchConfidence: (goldenRecord.matchConfidence + confidence) / 2,
        },
      });

      await this.prisma.recordVersion.create({
        data: {
          goldenRecordId,
          versionNumber: versionCount + 1,
          dataSnapshot: mergedData,
          changedFields,
        },
      });

      this.eventEmitter.emit('golden_record.updated', {
        orgId: organizationId,
        recordId: goldenRecordId,
        entityType: 'golden_record',
        changedFields,
      });
    }

    // Link source record
    await this.prisma.sourceRecord.update({
      where: { id: sourceRecordId },
      data: {
        goldenRecordId,
        status: 'matched',
      },
    });

    this.eventEmitter.emit('source_record.matched', {
      orgId: organizationId,
      recordId: goldenRecordId,
      entityType: 'golden_record',
      sourceSystem: sourceRecord.sourceSystem,
    });

    return goldenRecordId;
  }
}