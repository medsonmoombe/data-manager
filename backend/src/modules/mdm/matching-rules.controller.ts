import { Controller, Get, Post, Put, Delete, Body, Param, Req, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('matching-rules')
export class MatchingRulesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('mdm:manage')
  async list(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.matchingRule.findMany({
      where: { entityDefinition: { organizationId: orgId } },
      include: {
        entityDefinition: { select: { id: true, name: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  @Get('entities')
  async getEntities(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.entityDefinition.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, attributes: true },
    });
  }

  @Post()
  @RequirePermissions('mdm:manage')
  async create(@Req() req: any, @Body() dto: {
    entityDefinitionId: string;
    name: string;
    ruleType: 'exact' | 'fuzzy';
    fieldWeights: Record<string, number>;
    threshold: number;
  }) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    
    const entity = await this.prisma.entityDefinition.findFirst({
      where: { id: dto.entityDefinitionId, organizationId: orgId },
    });
    if (!entity) throw new NotFoundException('Entity not found');

    return this.prisma.matchingRule.create({
      data: {
        entityDefinitionId: dto.entityDefinitionId,
        name: dto.name,
        ruleType: dto.ruleType,
        fieldWeights: dto.fieldWeights,
        threshold: dto.threshold,
        isActive: true,
      },
    });
  }

  @Put(':id')
  @RequirePermissions('mdm:manage')
  async update(@Param('id') id: string, @Body() dto: Partial<{
    name: string;
    fieldWeights: Record<string, number>;
    threshold: number;
    isActive: boolean;
  }>) {
    const rule = await this.prisma.matchingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.matchingRule.update({
      where: { id },
      data: dto,
    });
  }

  @Delete(':id')
  @RequirePermissions('mdm:manage')
  async delete(@Param('id') id: string) {
    const rule = await this.prisma.matchingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.matchingRule.delete({ where: { id } });
  }

  @Post(':id/test')
  async testRule(@Param('id') id: string, @Body() body: { sourceData: Record<string, any>; targetData: Record<string, any> }) {
    const rule = await this.prisma.matchingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');

    const fieldWeights = rule.fieldWeights as Record<string, number>;
    let totalWeight = 0;
    let weightedScore = 0;

    for (const [field, weight] of Object.entries(fieldWeights)) {
      totalWeight += weight;
      const sourceValue = body.sourceData[field];
      const targetValue = body.targetData[field];
      
      if (sourceValue && targetValue) {
        const similarity = sourceValue === targetValue ? 1 : 
          String(sourceValue).toLowerCase().includes(String(targetValue).toLowerCase()) ? 0.8 : 0;
        weightedScore += similarity * weight;
      }
    }

    const score = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const isMatch = score >= rule.threshold;

    return { score, isMatch, threshold: rule.threshold };
  }
}