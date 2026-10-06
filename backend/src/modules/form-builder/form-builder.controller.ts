import {
  Controller, Get, Post, Put, Delete, Param, Body, Query, Req,
  BadRequestException, NotFoundException,
  UseInterceptors, UploadedFile, MaxFileSizeValidator, ParseFilePipe, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { SubmissionService } from './services/submission.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('forms')
export class FormBuilderController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly submissionService: SubmissionService,
    private readonly minioService: MinioService,
  ) {}

  // =====================
  // Form Definitions CRUD
  // =====================

  @Post()
  async createForm(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    return this.prisma.formDefinition.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description || null,
        formSchema: dto.formSchema || { fields: [], layout: {} },
        status: 'draft',
      },
    });
  }

  @Get()
  async listForms(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    return this.prisma.formDefinition.findMany({
      where: { organizationId: orgId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        formSchema: true,  
        version: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { submissions: true } },
      },
    });
  }

  @Get(':id')
  async getForm(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const form = await this.prisma.formDefinition.findFirst({
      where: { id, organizationId: orgId },
      include: {
        _count: { select: { submissions: true } },
      },
    });

    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  @Put(':id')
  async updateForm(@Param('id') id: string, @Body() dto: any) {
    const existing = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Form not found');

    // Build the updated formSchema — merge existing with new data
    const existingSchema = (existing.formSchema as any) || {};

    const updatedSchema: any = {
      ...existingSchema,
    };

    // Update fields if provided
    if (dto.formSchema?.fields) {
      updatedSchema.fields = dto.formSchema.fields;
    }

    // Store duplicateConfig INSIDE formSchema so it persists
    if (dto.duplicateConfig) {
      updatedSchema.duplicateConfig = {
        ...(existingSchema.duplicateConfig || {}),
        ...dto.duplicateConfig,
      };
    }

    // Increment version on schema changes
    const versionIncrement = dto.formSchema || dto.duplicateConfig ? 1 : 0;

    return this.prisma.formDefinition.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        description: dto.description ?? existing.description,
        formSchema: updatedSchema,
        version: existing.version + versionIncrement,
      },
    });
  }

  @Post(':id/publish')
  async publishForm(@Param('id') id: string) {
    const form = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!form) throw new NotFoundException('Form not found');
    if (form.status === 'published') {
      return { success: true, message: 'Form is already published' };
    }

    await this.prisma.formDefinition.update({
      where: { id },
      data: { status: 'published' },
    });

    return { success: true, message: `Form "${form.name}" published successfully` };
  }

  @Post(':id/retire')
  async retireForm(@Param('id') id: string) {
    await this.prisma.formDefinition.update({
      where: { id },
      data: { status: 'retired' },
    });

    return { success: true, message: 'Form retired' };
  }

  @Delete(':id')
  async deleteForm(@Param('id') id: string) {
    await this.prisma.formDefinition.delete({ where: { id } });
    return { success: true, message: 'Form deleted' };
  }

  // =====================
  // File Upload
  // =====================

  @Post(':id/upload-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @Param('id') formId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^(image\/|application\/pdf|text\/csv|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Req() req: any,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const result = await this.minioService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      { formId, organizationId: orgId, uploadedBy: req.user?.sub },
    );

    return {
      url: result.url,
      path: result.path,
      originalName: file.originalname,
      size: result.size,
      mimeType: file.mimetype,
    };
  }

  // =====================
  // Submissions
  // =====================

  @Post(':id/submit')
  async submitForm(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Record<string, any>,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;

    return this.submissionService.submit(id, orgId, dto, userId, req.ip);
  }

  @Get(':id/submissions')
  async getSubmissions(
    @Req() req: any,
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query() queryFilters: any,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    // Extract field filters from query params (anything except page, limit)
    const filters: Record<string, any> = {};
    for (const [key, value] of Object.entries(queryFilters)) {
      if (key !== 'page' && key !== 'limit') {
        filters[key] = value;
      }
    }

    return this.submissionService.getSubmissions(id, orgId, filters, page, limit);
  }

  // =====================
  // Search & Analytics
  // =====================

  @Get('search/global')
  async globalSearch(
    @Req() req: any,
    @Query('field') field: string,
    @Query('value') value: string,
  ) {
    if (!field || !value) throw new BadRequestException('field and value are required');

    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.submissionService.searchAcrossForms(orgId, field, value);
  }

  @Get(':id/stats/:fieldName')
  async getFieldStats(
    @Req() req: any,
    @Param('id') id: string,
    @Param('fieldName') fieldName: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.submissionService.getFieldStats(id, orgId, fieldName);
  }
}