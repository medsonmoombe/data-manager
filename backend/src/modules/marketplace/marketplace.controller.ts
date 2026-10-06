import { Controller, Get, Post, Param, Body, Req, Query } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TemplateInstallerService } from './template-installer.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateInstaller: TemplateInstallerService,
  ) {}

  /**
   * List all available templates.
   */
  @Get('templates')
  async listTemplates(
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const where: any = { isPublished: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.marketplaceTemplate.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        icon: true,
        version: true,
        includes: true,
        downloads: true,
        rating: true,
        isOfficial: true,
      },
      orderBy: [{ isOfficial: 'desc' }, { downloads: 'desc' }],
    });
  }

  /**
   * Get template details.
   */
  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.prisma.marketplaceTemplate.findUnique({
      where: { id },
    });
  }

  /**
   * Install a template for current organization.
   */
  @Post('templates/:id/install')
  async installTemplate(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.templateInstaller.installTemplate(orgId, id, userId);
  }

  /**
   * Customize an installed template.
   */
  @Post('templates/:id/customize')
  async customizeTemplate(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.templateInstaller.customizeTemplate(orgId, id, dto, userId);
  }

  /**
   * Get installed templates for current organization.
   */
  @Get('installed')
  async getInstalledTemplates(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.templateInstallation.findMany({
      where: { organizationId: orgId },
      include: { template: { select: { name: true, description: true, icon: true, category: true } } },
    });
  }

  /**
   * Uninstall a template.
   */
  @Post('templates/:id/uninstall')
  async uninstallTemplate(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.templateInstaller.uninstallTemplate(orgId, id);
  }

  /**
   * Seed official templates (admin only).
   */
  @Post('seed')
  async seedTemplates() {
    await this.templateInstaller.seedOfficialTemplates();
    return { success: true, message: 'Official templates seeded' };
  }

  /**
   * Get categories.
   */
  @Get('categories')
  async getCategories() {
    const categories = await this.prisma.marketplaceTemplate.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { id: true },
    });
    return categories.map((c) => ({ category: c.category, count: c._count.id }));
  }
}