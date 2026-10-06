import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

export interface SearchResult {
  type: 'golden_record' | 'form_submission' | 'relationship' | 'timeline_event';
  id: string;
  entityType?: string;
  title: string;
  description: string;
  data: Record<string, any>;
  relevance: number;
  timestamp: Date;
  matchedFields: string[];
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async globalSearch360(
    orgId: string,
    query: string,
    options?: {
      entityType?: string;
      limit?: number;
      includeRelationships?: boolean;
      includeTimeline?: boolean;
      minRelevance?: number;
    },
  ) {
    const limit = options?.limit || 50;
    const minRelevance = options?.minRelevance || 20;
    const searchTerm = query.trim().toLowerCase();

    if (!searchTerm || searchTerm.length < 2) {
      return this.emptyResponse(query);
    }

    const [goldenResults, formResults, relationshipResults, timelineResults] = await Promise.all([
      this.searchGoldenRecords(orgId, searchTerm, options?.entityType),
      this.searchFormSubmissions(orgId, searchTerm),
      options?.includeRelationships !== false ? this.searchRelationships(orgId, searchTerm) : Promise.resolve([]),
      options?.includeTimeline !== false ? this.searchTimeline(orgId, searchTerm) : Promise.resolve([]),
    ]);

    const uniqueResults = new Map<string, SearchResult>();
    for (const result of [...goldenResults, ...formResults, ...relationshipResults, ...timelineResults]) {
      const key = `${result.type}_${result.id}`;
      if (!uniqueResults.has(key) || uniqueResults.get(key)!.relevance < result.relevance) {
        uniqueResults.set(key, result);
      }
    }

    const allResults = Array.from(uniqueResults.values())
      .filter(r => r.relevance >= minRelevance)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    const byType: Record<string, number> = {};
    for (const result of allResults) {
      byType[result.type] = (byType[result.type] || 0) + 1;
    }

    return {
      query,
      results: allResults,
      summary: { total: allResults.length, byType, topMatches: allResults.slice(0, 5) },
      timestamp: new Date(),
    };
  }

  async emptyResponse(query: string) {
    return {
      query,
      results: [],
      summary: { total: 0, byType: {}, topMatches: [] },
      timestamp: new Date(),
    };
  }

  private async searchGoldenRecords(orgId: string, searchTerm: string, entityType?: string): Promise<SearchResult[]> {
    const whereEntity: any = { organizationId: orgId };
    if (entityType) whereEntity.name = entityType;

    const entities = await this.prisma.entityDefinition.findMany({
      where: whereEntity,
      select: { id: true, name: true },
    });

    if (entities.length === 0) return [];

    const records = await this.prisma.goldenRecord.findMany({
      where: {
        organizationId: orgId,
        entityDefinitionId: { in: entities.map(e => e.id) },
        status: 'active',
        deletedAt: null,
      },
      select: {
        id: true,
        data: true,
        matchConfidence: true,
        createdAt: true,
        updatedAt: true,
        entityDefinition: { select: { name: true } },
      },
      take: 200,
    });

    const results: SearchResult[] = [];

    for (const record of records) {
      const data = record.data as Record<string, any>;
      const matchedFields: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (value && String(value).toLowerCase().includes(searchTerm)) {
          matchedFields.push(key);
        }
      }

      if (matchedFields.length === 0) continue;

      const termCount = matchedFields.reduce((sum, f) => {
        const v = data[f];
        if (!v || typeof v !== 'string') return sum;
        const matches = v.toLowerCase().split(searchTerm).length - 1;
        return sum + matches;
      }, 0);

      const identifierBoost =
        matchedFields.some(f => ['nrc', 'email', 'full_name', 'phone'].includes(f)) ? 20 : 0;

      const relevance = Math.min(100, Math.round((termCount * 10) + identifierBoost + (matchedFields.length * 5)));

      const title = data.full_name || data.name || data.first_name ||
        (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : null) ||
        data.email || data.student_id ||
        `Record ${record.id.substring(0, 8)}`;

      results.push({
        type: 'golden_record',
        id: record.id,
        entityType: record.entityDefinition.name,
        title,
        description: this.generateDescription(data, matchedFields),
        data,
        relevance,
        timestamp: record.updatedAt || record.createdAt,
        matchedFields,
      });
    }

    return results;
  }

  private async searchFormSubmissions(orgId: string, searchTerm: string): Promise<SearchResult[]> {
    const submissions = await this.prisma.formSubmission.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        data: true,
        submittedAt: true,
        formDefinition: { select: { name: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });

    const results: SearchResult[] = [];

    for (const sub of submissions) {
      const data = sub.data as Record<string, any>;
      const matchedFields: string[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (value && String(value).toLowerCase().includes(searchTerm)) {
          matchedFields.push(key);
        }
      }

      if (matchedFields.length === 0) continue;

      const relevance = Math.min(100, matchedFields.length * 15);
      const title = data.full_name || data.name || sub.formDefinition.name || `Submission ${sub.id.substring(0, 8)}`;

      results.push({
        type: 'form_submission',
        id: sub.id,
        entityType: sub.formDefinition.name,
        title,
        description: this.generateDescription(data, matchedFields),
        data,
        relevance,
        timestamp: sub.submittedAt,
        matchedFields,
      });
    }

    return results;
  }

  private async searchRelationships(orgId: string, searchTerm: string): Promise<SearchResult[]> {
    const relationships = await this.prisma.recordRelationship.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { relationshipType: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });

    return relationships.map(rel => ({
      type: 'relationship' as const,
      id: rel.id,
      title: `${rel.sourceEntityType} → ${rel.targetEntityType}`,
      description: `Relationship: ${rel.relationshipType.replace(/_/g, ' ')} (confidence: ${Math.round((rel.confidence || 1) * 100)}%)`,
      data: { relationshipType: rel.relationshipType, metadata: rel.metadata } as Record<string, any>,
      relevance: 70,
      timestamp: rel.createdAt,
      matchedFields: ['relationshipType'],
    }));
  }

  private async searchTimeline(orgId: string, searchTerm: string): Promise<SearchResult[]> {
    const events = await this.prisma.recordTimelineEvent.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { eventType: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      take: 30,
      orderBy: { occurredAt: 'desc' },
    });

    return events.map(event => ({
      type: 'timeline_event' as const,
      id: event.id,
      title: event.eventType.replace(/_/g, ' '),
      description: JSON.stringify(event.eventData).substring(0, 100),
      data: event.eventData as Record<string, any>,
      relevance: 60,
      timestamp: event.occurredAt,
      matchedFields: ['eventType'],
    }));
  }

  private generateDescription(data: Record<string, any>, matchedFields: string[]): string {
    const parts: string[] = [];

    for (const field of matchedFields.slice(0, 3)) {
      const value = data[field];
      if (value && typeof value === 'string' && value.length < 100) {
        parts.push(`${field}: ${value}`);
      }
    }

    if (parts.length === 0 && matchedFields.length > 0) {
      parts.push(`Matches in: ${matchedFields.join(', ')}`);
    }

    return parts.join(' · ') || 'Match found in record data';
  }
}
