import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Builds 360° profiles for any entity.
 * Aggregates data from golden records, relationships, timeline, form submissions.
 */
@Injectable()
export class ProfileBuilderService {
  private readonly logger = new Logger(ProfileBuilderService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a complete profile for a golden record.
   * Includes: master data, relationships, recent timeline, form submissions, stats.
   */
  async buildProfile(orgId: string, entityType: string, recordId: string) {
    const startTime = Date.now();

    // Fetch golden record with minimal fields
    const goldenRecord = await this.prisma.goldenRecord.findFirst({
      where: { id: recordId, organizationId: orgId },
      select: {
        id: true,
        data: true,
        entityDefinitionId: true,
        matchConfidence: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!goldenRecord) return null;

    // Fetch relationships (both directions) in parallel
    const [outgoing, incoming] = await Promise.all([
      this.prisma.recordRelationship.findMany({
        where: { organizationId: orgId, sourceEntityType: entityType, sourceRecordId: recordId },
        select: { targetEntityType: true, targetRecordId: true, relationshipType: true, metadata: true },
        take: 50,
      }),
      this.prisma.recordRelationship.findMany({
        where: { organizationId: orgId, targetEntityType: entityType, targetRecordId: recordId },
        select: { sourceEntityType: true, sourceRecordId: true, relationshipType: true, metadata: true },
        take: 50,
      }),
    ]);

    // Fetch recent timeline events
    const timeline = await this.prisma.recordTimelineEvent.findMany({
      where: { organizationId: orgId, entityType, recordId },
      orderBy: { occurredAt: 'desc' },
      take: 20,
      select: { eventType: true, eventData: true, occurredAt: true },
    });

    // Fetch related form submissions (if entity type matches)
    const submissions = await this.prisma.formSubmission.findMany({
      where: {
        organizationId: orgId,
        data: { path: ['entity_id'], equals: recordId },
      },
      select: {
        id: true,
        data: true,
        submittedAt: true,
        formDefinition: { select: { name: true } },
      },
      take: 10,
      orderBy: { submittedAt: 'desc' },
    });

    // Count source records (lineage)
    const sourceCount = await this.prisma.sourceRecord.count({
      where: { goldenRecordId: recordId },
    });

    // Count versions
    const versionCount = await this.prisma.recordVersion.count({
      where: { goldenRecordId: recordId },
    });

    // Build the profile
    const profile = {
      id: goldenRecord.id,
      entityType,
      masterData: goldenRecord.data,
      matchConfidence: goldenRecord.matchConfidence,
      metadata: {
        sourceRecords: sourceCount,
        versions: versionCount,
        createdAt: goldenRecord.createdAt,
        updatedAt: goldenRecord.updatedAt,
      },
      relationships: {
        outgoing,
        incoming,
        total: outgoing.length + incoming.length,
      },
      timeline: timeline.map((e) => ({
        type: e.eventType,
        data: e.eventData,
        occurredAt: e.occurredAt,
      })),
      submissions: submissions.map((s) => ({
        id: s.id,
        formName: s.formDefinition.name,
        data: s.data,
        submittedAt: s.submittedAt,
      })),
      stats: {
        submissionCount: submissions.length,
        relationshipCount: outgoing.length + incoming.length,
        timelineEventCount: timeline.length,
      },
    };

    const duration = Date.now() - startTime;
    this.logger.log(`Profile built for ${entityType}:${recordId} in ${duration}ms`);

    // Cache the profile
    await this.cacheProfile(orgId, entityType, recordId, profile);

    return profile;
  }

  /**
   * Cache a profile for fast retrieval.
   */
  private async cacheProfile(
    orgId: string,
    entityType: string,
    recordId: string,
    profile: any,
  ) {
    await this.prisma.entityProfile.upsert({
      where: {
        entityType_recordId_organizationId: {
          entityType,
          recordId,
          organizationId: orgId,
        },
      },
      create: {
        entityType,
        recordId,
        organizationId: orgId,
        profileJson: profile,
        lastBuiltAt: new Date(),
      },
      update: {
        profileJson: profile,
        lastBuiltAt: new Date(),
      },
    });
  }

  /**
   * Get a cached profile if fresh, otherwise rebuild.
   * Cache TTL: 5 minutes.
   */
  async getProfile(orgId: string, entityType: string, recordId: string) {
    const cached = await this.prisma.entityProfile.findUnique({
      where: {
        entityType_recordId_organizationId: {
          entityType,
          recordId,
          organizationId: orgId,
        },
      },
    });

    const cacheAge = cached
      ? Date.now() - new Date(cached.lastBuiltAt).getTime()
      : Infinity;

    // Use cache if less than 5 minutes old
    if (cached && cacheAge < 5 * 60 * 1000) {
      return cached.profileJson;
    }

    // Rebuild
    return this.buildProfile(orgId, entityType, recordId);
  }

  /**
   * Invalidate cache for a record (called when data changes).
   */
  async invalidateCache(orgId: string, entityType: string, recordId: string) {
    await this.prisma.entityProfile.deleteMany({
      where: { organizationId: orgId, entityType, recordId },
    });
  }
}