import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('saved-searches')
export class SavedSearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listSearches(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.savedSearch.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post()
  async createSearch(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.savedSearch.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        entityName: dto.entityName,
        query: dto.query,
        sortField: dto.sortField,
        sortDirection: dto.sortDirection || 'desc',
        isPublic: dto.isPublic || false,
        createdBy: req.user?.sub,
      },
    });
  }

  @Get(':id')
  async getSearch(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.savedSearch.findFirst({
      where: { id, organizationId: orgId },
    });
  }

  @Put(':id')
  async updateSearch(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.savedSearch.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  async deleteSearch(@Param('id') id: string) {
    return this.prisma.savedSearch.delete({ where: { id } });
  }

  /**
   * Execute a saved search and return results.
   */
  @Get(':id/execute')
  async executeSearch(@Param('id') id: string, @Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const search = await this.prisma.savedSearch.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!search) throw new Error('Saved search not found');

    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: search.entityName },
    });

    if (!entityDef) return { data: [], total: 0 };

    const query = search.query as any;
    const conditions = query.conditions || [];
    const logic = query.logic || 'AND';

    // Build Prisma where clause
    const dataConditions = conditions.map((c: any) => {
      const path = [c.field];
      switch (c.operator) {
        case 'equals': return { data: { path, equals: c.value } };
        case 'contains': return { data: { path, string_contains: c.value } };
        case 'gt': return { data: { path, gt: Number(c.value) } };
        case 'lt': return { data: { path, lt: Number(c.value) } };
        default: return { data: { path, string_contains: c.value } };
      }
    });

    const where: any = {
      organizationId: orgId,
      entityDefinitionId: entityDef.id,
      status: 'active',
      deletedAt: null,
    };

    if (dataConditions.length > 0) {
      where[logic === 'OR' ? 'OR' : 'AND'] = dataConditions;
    }

    const [data, total] = await Promise.all([
      this.prisma.goldenRecord.findMany({
        where,
        select: { id: true, data: true, createdAt: true, updatedAt: true },
        orderBy: { [search.sortField || 'createdAt']: search.sortDirection || 'desc' },
        take: 50,
      }),
      this.prisma.goldenRecord.count({ where }),
    ]);

    return { data, total, search: search.name };
  }
}