import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ValidationEngineService } from './validation-engine.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('validation')
export class ValidationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationEngine: ValidationEngineService,
  ) {}

  // Rules CRUD

  @Get('rules')
  async listRules(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.validationRule.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { results: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('rules')
  async createRule(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.validationRule.create({
      data: { organizationId: orgId, ...dto },
    });
  }

  @Put('rules/:id')
  async updateRule(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.validationRule.update({ where: { id }, data: dto });
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.prisma.validationRule.delete({ where: { id } });
  }

  // Results

  @Get('results')
  async listResults(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('ruleId') ruleId?: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const where: any = { rule: { organizationId: orgId } };
    if (status) where.status = status;
    if (ruleId) where.ruleId = ruleId;

    return this.prisma.validationResult.findMany({
      where,
      include: { rule: { select: { name: true, errorMessage: true, severity: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('results/:id/fix')
  async fixResult(@Param('id') id: string) {
    return this.prisma.validationResult.update({
      where: { id },
      data: { status: 'fixed', resolvedAt: new Date() },
    });
  }

  @Post('results/:id/ignore')
  async ignoreResult(@Param('id') id: string) {
    return this.prisma.validationResult.update({
      where: { id },
      data: { status: 'ignored', resolvedAt: new Date() },
    });
  }

  // Batch validation

  @Post('run/:entityName')
  async runBatchValidation(@Req() req: any, @Param('entityName') entityName: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.validationEngine.runBatchValidation(orgId, entityName);
  }

  // Data quality summary

  @Get('summary')
  async getSummary(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const [totalRules, openIssues, fixedIssues] = await Promise.all([
      this.prisma.validationRule.count({ where: { organizationId: orgId, isActive: true } }),
      this.prisma.validationResult.count({ where: { rule: { organizationId: orgId }, status: 'open' } }),
      this.prisma.validationResult.count({ where: { rule: { organizationId: orgId }, status: 'fixed' } }),
    ]);

    return {
      totalRules,
      openIssues,
      fixedIssues,
      dataQualityScore: totalRules > 0 ? Math.round((1 - openIssues / (openIssues + fixedIssues + 1)) * 100) : 100,
    };
  }
}