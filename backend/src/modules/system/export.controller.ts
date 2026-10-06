import { Controller, Get, Post, Param, Query, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from '../../common/services/export.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * Export golden records for an entity.
   * GET /api/v1/export/:entityName?format=csv&field=value
   */
  @Get(':entityName')
  async exportData(
    @Req() req: any,
    @Res() res: Response,
    @Param('entityName') entityName: string,
    @Query('format') format: string = 'csv',
    @Query() queryParams: any,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    
    // Extract filters (exclude 'format' from filters)
    const filters: Record<string, any> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'format') filters[key] = value;
    }

    const result = await this.exportService.exportGoldenRecords(
      orgId,
      entityName,
      format as 'csv' | 'json' | 'xlsx',
      Object.keys(filters).length > 0 ? filters : undefined,
    );

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }
}