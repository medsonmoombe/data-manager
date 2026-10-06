import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

interface SearchCondition {
  field: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
  value: any;
  value2?: any; // For 'between'
}

interface SearchQuery {
  entityName: string;
  conditions: SearchCondition[];
  logic: 'AND' | 'OR';
  sort?: { field: string; direction: 'asc' | 'desc' };
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Advanced search across golden records with complex conditions.
   */
  async searchGoldenRecords(orgId: string, query: SearchQuery) {
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: query.entityName },
    });
    if (!entityDef) throw new Error(`Entity ${query.entityName} not found`);

    // Build JSONB path conditions
    const dataConditions: any[] = [];

    for (const condition of query.conditions) {
      const path = [condition.field];
      const value = condition.value;

      switch (condition.operator) {
        case 'equals':
          dataConditions.push({ data: { path, equals: value } });
          break;
        case 'contains':
          dataConditions.push({ data: { path, string_contains: value } });
          break;
        case 'starts_with':
          dataConditions.push({ data: { path, string_starts_with: value } });
          break;
        case 'ends_with':
          dataConditions.push({ data: { path, string_ends_with: value } });
          break;
        case 'gt':
          dataConditions.push({ data: { path, gt: Number(value) } });
          break;
        case 'lt':
          dataConditions.push({ data: { path, lt: Number(value) } });
          break;
        case 'gte':
          dataConditions.push({ data: { path, gte: Number(value) } });
          break;
        case 'lte':
          dataConditions.push({ data: { path, lte: Number(value) } });
          break;
        case 'in':
          dataConditions.push({ data: { path, in: Array.isArray(value) ? value : [value] } });
          break;
        case 'between':
          dataConditions.push({
            data: { path, gte: Number(value), lte: Number(condition.value2) },
          });
          break;
      }
    }

    const where: any = {
      organizationId: orgId,
      entityDefinitionId: entityDef.id,
      status: 'active',
      deletedAt: null,
    };

    if (dataConditions.length > 0) {
      if (query.logic === 'OR') {
        where.OR = dataConditions;
      } else {
        where.AND = dataConditions;
      }
    }

    const orderBy: any = {};
    if (query.sort) {
      orderBy.data = { path: [query.sort.field], direction: query.sort.direction };
    } else {
      orderBy.updatedAt = 'desc';
    }

    const page = query.page || 1;
    const limit = query.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.goldenRecord.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          data: true,
          matchConfidence: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.goldenRecord.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * Full-text search across all entities (global search).
   */
  async globalSearch(orgId: string, query: string, entityType?: string) {
    const where: any = {
      organizationId: orgId,
      status: 'active',
      deletedAt: null,
    };

    if (entityType) {
      const entityDef = await this.prisma.entityDefinition.findFirst({
        where: { organizationId: orgId, name: entityType },
      });
      if (entityDef) where.entityDefinitionId = entityDef.id;
    }

    // Search across common fields
    const results = await this.prisma.goldenRecord.findMany({
      where: {
        ...where,
        OR: [
          { data: { path: ['first_name'], string_contains: query } },
          { data: { path: ['last_name'], string_contains: query } },
          { data: { path: ['nrc'], string_contains: query } },
          { data: { path: ['phone'], string_contains: query } },
          { data: { path: ['email'], string_contains: query } },
          { data: { path: ['district'], string_contains: query } },
          { data: { path: ['farm_name'], string_contains: query } },
        ],
      },
      include: {
        entityDefinition: { select: { name: true } },
      },
      take: 25,
      orderBy: { updatedAt: 'desc' },
    });

    return {
      query,
      results: results.map((r) => ({
        entityType: r.entityDefinition.name,
        id: r.id,
        data: r.data,
        matchConfidence: r.matchConfidence,
      })),
      total: results.length,
    };
  }

  /**
   * Get search suggestions (auto-complete).
   */
  async getSuggestions(orgId: string, entityName: string, field: string, prefix: string) {
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: entityName },
    });
    if (!entityDef) return [];

    const records = await this.prisma.goldenRecord.findMany({
      where: {
        organizationId: orgId,
        entityDefinitionId: entityDef.id,
        data: { path: [field], string_starts_with: prefix },
      },
      select: { data: true },
      take: 10,
    });

    // Extract unique values for the field
    const values = new Set<string>();
    for (const record of records) {
      const val = (record.data as Record<string, any>)[field];
      if (val) values.add(String(val));
    }

    return Array.from(values).slice(0, 10);
  }
}