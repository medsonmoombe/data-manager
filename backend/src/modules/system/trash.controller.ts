import { Controller, Get, Post, Delete, Param, Query, Req, BadRequestException } from '@nestjs/common';
import { SoftDeleteService } from '../../common/services/soft-delete.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

const SUPPORTED_MODELS = ['goldenRecord', 'formSubmission', 'formDefinition'];

@Controller('system/trash')
export class TrashController {
  constructor(
    private readonly softDelete: SoftDeleteService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get trash for a specific model.
   * GET /api/v1/system/trash/:modelName
   */
  @Get(':modelName')
  async getTrash(
    @Req() req: any,
    @Param('modelName') modelName: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    if (!SUPPORTED_MODELS.includes(modelName)) {
      throw new BadRequestException(`Unsupported model: ${modelName}. Supported: ${SUPPORTED_MODELS.join(', ')}`);
    }

    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.softDelete.getTrash(modelName, orgId, page, limit);
  }

  /**
   * Restore a record from trash.
   * POST /api/v1/system/trash/:modelName/:id/restore
   */
  @Post(':modelName/:id/restore')
  async restore(
    @Req() req: any,
    @Param('modelName') modelName: string,
    @Param('id') id: string,
  ) {
    if (!SUPPORTED_MODELS.includes(modelName)) {
      throw new BadRequestException(`Unsupported model: ${modelName}`);
    }

    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.softDelete.restore(modelName, id, orgId);
  }

  /**
   * Permanently delete a record (bypasses soft delete).
   * DELETE /api/v1/system/trash/:modelName/:id/permanent
   */
  @Delete(':modelName/:id/permanent')
  async permanentDelete(
    @Req() req: any,
    @Param('modelName') modelName: string,
    @Param('id') id: string,
  ) {
    if (!SUPPORTED_MODELS.includes(modelName)) {
      throw new BadRequestException(`Unsupported model: ${modelName}`);
    }

    // This is a hard delete — handled by a raw query to bypass Prisma middleware
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    
    // Verify ownership first
    const record = await (this.prisma[modelName as any] as any).findFirst({
      where: { id, organizationId: orgId },
    });

    if (!record) throw new BadRequestException('Record not found');

    // Hard delete using raw SQL
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "${this.getTableName(modelName)}" WHERE id = $1 AND org_id = $2`,
      id,
      orgId,
    );

    return { success: true, message: 'Permanently deleted' };
  }

  private getTableName(modelName: string): string {
    const mapping: Record<string, string> = {
      goldenRecord: 'golden_records',
      formSubmission: 'form_submissions',
      formDefinition: 'form_definitions',
    };
    return mapping[modelName] || modelName;
  }
}