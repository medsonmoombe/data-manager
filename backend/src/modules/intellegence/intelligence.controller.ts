import { Controller, Get, Post, Delete, Param, Query, Body, Req, NotFoundException, Put, BadRequestException } from '@nestjs/common';
import { ProfileBuilderService } from './services/profile-builder.service';
import { RelationshipService } from './services/relationship.service';
import { CreateRelationshipDto } from './dto/create-relationship.dto';
import { PaginationDto } from './dto/pagination.dto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AutoLinkService } from './services/auto-link.service';
import { CreateAutoLinkRuleDto } from './dto/create-auto-link-rule.dto';
import { DuplicateDetectorService } from './services/duplicate-detector.service'
import { LineageService } from './services/lineage.service';
import { NarrativeReportService } from './services/narrative-report.service';
import { SearchService } from './services/search.service';

@Controller('intelligence')
export class IntelligenceController {
  constructor(
    private readonly profileBuilder: ProfileBuilderService,
    private readonly relationshipService: RelationshipService,
    private readonly prisma: PrismaService,
    private readonly autoLinkService: AutoLinkService,
    private readonly  duplicateDetecorService: DuplicateDetectorService,
    private readonly lineageService: LineageService,
    private readonly narrativeReport: NarrativeReportService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Get a 360° profile for any entity.
   * GET /api/v1/intelligence/profile/:entityType/:recordId
   */
  @Get('profile/:entityType/:recordId')
  async getProfile(
    @Req() req: any,
    @Param('entityType') entityType: string,
    @Param('recordId') recordId: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const profile = await this.profileBuilder.getProfile(orgId, entityType, recordId);
    if (!profile) throw new NotFoundException('Record not found');
    return profile;
  }

  /**
   * Force rebuild a profile (ignores cache).
   */
  @Post('profile/:entityType/:recordId/rebuild')
  async rebuildProfile(
    @Req() req: any,
    @Param('entityType') entityType: string,
    @Param('recordId') recordId: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    // Invalidate cache first
    await this.profileBuilder.invalidateCache(orgId, entityType, recordId);
    // Build fresh
    const profile = await this.profileBuilder.buildProfile(orgId, entityType, recordId);
    if (!profile) throw new NotFoundException('Record not found');
    return profile;
  }

  /**
   * Get relationships for an entity.
   */
  @Get('relationships/:entityType/:recordId')
  async getRelationships(
    @Req() req: any,
    @Param('entityType') entityType: string,
    @Param('recordId') recordId: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.relationshipService.getRelationships(orgId, entityType, recordId);
  }

  /**
   * Create a relationship between two entities.
   */
  @Post('relationships')
  async createRelationship(@Req() req: any, @Body() dto: CreateRelationshipDto) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.relationshipService.create(orgId, dto, userId);
  }

  @Post('relationships/bulk')
  async createBulkRelationships(@Req() req: any, @Body() body: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.relationshipService.createBulk(orgId, body.relationships || [], userId);
  }

  /**
   * Delete a relationship.
   */
  @Delete('relationships/:id')
  async deleteRelationship(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.relationshipService.delete(orgId, id);
  }

  /**
   * Get all records related to an entity (1-hop graph).
   */
  @Get('related/:entityType/:recordId')
  async getRelatedRecords(
    @Req() req: any,
    @Param('entityType') entityType: string,
    @Param('recordId') recordId: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.relationshipService.getRelatedRecords(orgId, entityType, recordId);
  }

  /**
   * Get timeline events for an entity.
   */
  @Get('timeline/:entityType/:recordId')
  async getTimeline(
    @Req() req: any,
    @Param('entityType') entityType: string,
    @Param('recordId') recordId: string,
    @Query() pagination: PaginationDto,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const { page = 1, limit = 20 } = pagination;

    const [events, total] = await Promise.all([
      this.prisma.recordTimelineEvent.findMany({
        where: { organizationId: orgId, entityType, recordId },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          eventType: true,
          eventData: true,
          actorUserId: true,
          occurredAt: true,
        },
      }),
      this.prisma.recordTimelineEvent.count({
        where: { organizationId: orgId, entityType, recordId },
      }),
    ]);

    return { data: events, total, page, limit };
  }

  /**
   * 360° Dynamic Search across golden records, form submissions, relationships, and timeline.
   */
  @Get('search')
  async globalSearch(
    @Req() req: any,
    @Query('q') query: string,
    @Query('entityType') entityType?: string,
    @Query('includeRelationships') includeRelationships?: string,
    @Query('includeTimeline') includeTimeline?: string,
    @Query('limit') limit?: number,
  ) {
    if (!query || query.trim().length < 2) {
      return this.searchService.emptyResponse(query);
    }

    const orgId = req.user?.orgId || req.headers['x-org-id'];

    return this.searchService.globalSearch360(orgId, query, {
      entityType,
      includeRelationships: includeRelationships !== 'false',
      includeTimeline: includeTimeline !== 'false',
      limit: limit || 50,
      minRelevance: 10,
    });
  }

  // =====================
// Auto-Link Rules Management
// =====================

@Get('auto-link-rules')
async getAutoLinkRules(@Req() req: any) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.prisma.autoLinkRule.findMany({
    where: { organizationId: orgId },
    orderBy: { priority: 'desc' },
  });
}

@Post('auto-link-rules')
async createAutoLinkRule(@Req() req: any, @Body() dto: CreateAutoLinkRuleDto) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.prisma.autoLinkRule.create({
    data: {
      organizationId: orgId,
      ...dto,
      fieldMappings: dto.fieldMappings as unknown as any,
    },
  });
}

@Put('auto-link-rules/:id')
async updateAutoLinkRule(
  @Param('id') id: string,
  @Body() dto: Partial<CreateAutoLinkRuleDto>,
) {
  return this.prisma.autoLinkRule.update({
    where: { id },
    data: {
      ...dto,
      ...(dto.fieldMappings ? { fieldMappings: dto.fieldMappings as unknown as any } : {}),
    },
  });
}

@Delete('auto-link-rules/:id')
async deleteAutoLinkRule(@Param('id') id: string) {
  return this.prisma.autoLinkRule.delete({ where: { id } });
}

@Post('auto-link-rules/:id/test')
async testAutoLinkRule(@Req() req: any, @Param('id') id: string) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const rule = await this.prisma.autoLinkRule.findUnique({ where: { id } });
  if (!rule) throw new NotFoundException('Rule not found');
  return { rule, message: 'Rule is active and will be applied on next data import or form submission' };
}

@Get('auto-link-rules/:id/matches')
async getAutoLinkRuleMatches(@Req() req: any, @Param('id') id: string, @Query('limit') limit?: number): Promise<any> {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.autoLinkService.getRuleMatches(orgId, id, limit || 100);
}

@Post('auto-link/run')
async runAutoLink(@Req() req: any) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.autoLinkService.runFullAutoLink(orgId);
}

// =====================
// Suggestions Management
// =====================

@Get('suggestions')
async getSuggestions(
  @Req() req: any,
  @Query('status') status?: string,
  @Query('type') type?: string,
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const where: any = { organizationId: orgId };
  if (status) where.status = status;
  if (type) where.suggestionType = type;

  return this.prisma.suggestion.findMany({
    where,
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    take: 50,
  });
}

@Post('suggestions/:id/accept')
async acceptSuggestion(@Req() req: any, @Param('id') id: string) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const userId = req.user?.sub;

  const suggestion = await this.prisma.suggestion.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!suggestion) throw new NotFoundException('Suggestion not found');
  if (suggestion.status !== 'pending') {
    return { success: true, message: 'Suggestion already resolved', status: suggestion.status };
  }

  const action = suggestion.proposedAction as any;

  if (action.action === 'create_relationship') {
    await this.prisma.recordRelationship.create({
      data: {
        organizationId: orgId,
        sourceEntityType: suggestion.entityTypeA!,
        sourceRecordId: suggestion.entityIdA!,
        targetEntityType: suggestion.entityTypeB!,
        targetRecordId: suggestion.entityIdB!,
        relationshipType: action.relationshipType,
        confidence: suggestion.confidence,
        isInferred: true,
      },
    });
  }

  // Mark as accepted
  await this.prisma.suggestion.update({
    where: { id },
    data: { status: 'accepted', resolvedBy: userId, resolvedAt: new Date() },
  });

  return { success: true, message: 'Suggestion accepted' };
}

@Post('suggestions/:id/reject')
async rejectSuggestion(@Req() req: any, @Param('id') id: string) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const userId = req.user?.sub;

  const suggestion = await this.prisma.suggestion.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!suggestion) throw new NotFoundException('Suggestion not found');
  if (suggestion.status !== 'pending') {
    return { success: true, message: 'Suggestion already resolved', status: suggestion.status };
  }

  await this.prisma.suggestion.update({
    where: { id },
    data: { status: 'rejected', resolvedBy: userId, resolvedAt: new Date() },
  });

  return { success: true, message: 'Suggestion rejected' };
}

@Post('suggestions/:id/dismiss')
async dismissSuggestion(@Req() req: any, @Param('id') id: string) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const userId = req.user?.sub;

  await this.prisma.suggestion.updateMany({
    where: { id, organizationId: orgId, status: 'pending' },
    data: { status: 'dismissed', resolvedBy: userId, resolvedAt: new Date() },
  });

  return { success: true, message: 'Suggestion dismissed' };
}


/**
 * Get version history for a golden record with diffs.
 */
@Get('versions/:entityType/:recordId')
async getVersionHistory(
  @Req() req: any,
  @Param('entityType') entityType: string,
  @Param('recordId') recordId: string,
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  const versions = await this.prisma.recordVersion.findMany({
    where: { goldenRecordId: recordId },
    orderBy: { versionNumber: 'desc' },
    select: {
      versionNumber: true,
      dataSnapshot: true,
      changedFields: true,
      updatedBy: true,
      updatedAt: true,
    },
  });

  // Generate diffs between versions
  const versionsWithDiff = versions.map((v, index) => {
    const previous = versions[index + 1];
    const diff: Record<string, { from: any; to: any }> = {};

    if (previous && v.changedFields) {
      for (const field of v.changedFields) {
        const currentData = v.dataSnapshot as Record<string, any>;
        const prevData = previous.dataSnapshot as Record<string, any>;
        diff[field] = {
          from: prevData[field] ?? null,
          to: currentData[field] ?? null,
        };
      }
    }

    return {
      versionNumber: v.versionNumber,
      changedFields: v.changedFields,
      diff,
      updatedBy: v.updatedBy,
      updatedAt: v.updatedAt,
    };
  });

  return { data: versionsWithDiff, total: versionsWithDiff.length };
}

/**
 * Restore a previous version (creates a new version with old data).
 */
@Post('versions/:entityType/:recordId/restore/:versionNumber')
async restoreVersion(
  @Req() req: any,
  @Param('entityType') entityType: string,
  @Param('recordId') recordId: string,
  @Param('versionNumber') versionNumber: number,
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  const version = await this.prisma.recordVersion.findFirst({
    where: { goldenRecordId: recordId, versionNumber },
  });

  if (!version) throw new NotFoundException('Version not found');

  const oldData = version.dataSnapshot as Record<string, any>;

  // Create a new version with old data
  const goldenRecord = await this.prisma.goldenRecord.update({
    where: { id: recordId },
    data: {
      data: oldData,
      updatedBy: req.user?.sub,
    },
  });

  // Record version
  const newVersion = await this.prisma.recordVersion.create({
    data: {
      goldenRecordId: recordId,
      versionNumber: (await this.prisma.recordVersion.count({ where: { goldenRecordId: recordId } })) + 1,
      dataSnapshot: oldData,
      changedFields: Object.keys(oldData),
      updatedBy: req.user?.sub,
    },
  });

  return {
    success: true,
    message: `Restored to version ${versionNumber}`,
    record: goldenRecord,
    newVersion,
  };
}


/**
 * Get duplicate detection summary for the org.
 */
@Get('duplicates/summary')
async getDuplicateSummary(@Req() req: any) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.duplicateDetecorService.getDuplicateSummary(orgId);
}

/**
 * Get duplicate groups for review.
 */
@Get('duplicates')
async getDuplicates(
  @Req() req: any,
  @Query('confidence') confidence?: string,
  @Query('status') status?: string,
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.duplicateDetecorService.getPendingDuplicates(orgId);
}

/**
 * Auto-merge a duplicate pair.
 */
@Post('duplicates/:suggestionId/merge')
async mergeDuplicates(@Req() req: any, @Param('suggestionId') suggestionId: string) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const userId = req.user?.sub;
  return this.duplicateDetecorService.mergeDuplicates(suggestionId, userId);
}

/**
 * Trigger manual duplicate scan with progress tracking.
 */
@Post('duplicates/scan')
async triggerDuplicateScan(@Req() req: any, @Body() body: { entityName?: string }) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const jobId = await this.duplicateDetecorService.startScan(orgId, body?.entityName);
  return { jobId, message: 'Scan started' };
}

/**
 * Get duplicate scan progress.
 */
@Get('duplicates/scan/:jobId/progress')
async getScanProgress(@Param('jobId') jobId: string) {
  return this.duplicateDetecorService.getScanProgress(jobId);
}


/**
 * Get data lineage graph for a record.
 * Returns nodes and edges for visualization.
 */
@Get('lineage/:entityType/:recordId')
async getLineage(
  @Req() req: any,
  @Param('entityType') entityType: string,
  @Param('recordId') recordId: string,
): Promise<any> {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.lineageService.buildLineage(orgId, recordId);
}

/**
 * Generate a narrative report.
 */
@Get('reports/narrative')
async generateNarrativeReport(
  @Req() req: any,
  @Query('period') period: string = 'month',
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  return this.narrativeReport.generateReport(orgId, period as 'week' | 'month' | 'quarter');
}
}