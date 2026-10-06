import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { BadRequestException, NotFoundException } from '@nestjs/common';

@Controller('mdm')
export class MdmController {
  private readonly logger = new Logger(MdmController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * List all golden records for an entity type.
   */
  @RequirePermissions('records:read')
@Get('records/:entityName')
async listRecords(
  @Req() req: any,
  @Param('entityName') entityName: string,
  @Query('page') page: any = 1,
  @Query('limit') limit: any = 20,
  @Query('search') search?: string,
  @Query() allParams?: any,  // Catch all query params
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const pageNum = parseInt(String(page), 10) || 1;
  const limitNum = parseInt(String(limit), 10) || 20;

  const entityDef = await this.prisma.entityDefinition.findFirst({
    where: { organizationId: orgId, name: entityName },
  });

  if (!entityDef) return { data: [], total: 0 };

  const where: any = {
    organizationId: orgId,
    entityDefinitionId: entityDef.id,
    status: 'active',
    deletedAt: null,
  };

  // Handle search across all entity attributes (case-insensitive)
  if (search) {
    const entityAttrs = await this.prisma.entityAttribute.findMany({
      where: { entityDefinitionId: entityDef.id },
    });

    if (entityAttrs.length > 0) {
      try {
        const searchTerm = String(search).toLowerCase();
        const fieldNames = entityAttrs.map(a => a.name);
        const searchParamIdx = fieldNames.length + 1;
        const orgIdIdx = fieldNames.length + 2;
        const entityDefIdIdx = fieldNames.length + 3;

        const conditionParts = fieldNames.map((_, i) =>
          `LOWER(data->>$${i + 1}) LIKE '%' || LOWER($${searchParamIdx}) || '%'`
        );
        const conditions = conditionParts.join(' OR ');

        const sql = `
          SELECT id FROM golden_records
          WHERE organization_id = $${orgIdIdx}
            AND entity_definition_id = $${entityDefIdIdx}
            AND status = 'active'
            AND deleted_at IS NULL
            AND (${conditions})
        `;

        const matchingRows: { id: string }[] = await this.prisma.$queryRawUnsafe(
          sql,
          ...fieldNames,
          searchTerm,
          orgId,
          entityDef.id
        );

        if (matchingRows.length > 0) {
          where.id = { in: matchingRows.map(r => r.id) };
        } else {
          where.id = { in: [] };
        }
      } catch (e) {
        this.logger.warn(`Raw search query failed, falling back to string_contains: ${e}`);
        const orConditions = entityAttrs.map((attr) => ({
          data: { path: [attr.name], string_contains: String(search) },
        }));
        if (orConditions.length > 0) {
          where.AND = [...(where.AND || []), { OR: orConditions }];
        }
      }
    }
  }

  // Parse filter[fieldName]=value from query params
  if (allParams) {
    const dataConditions: any[] = [];

    for (const [key, value] of Object.entries(allParams)) {
      // Match "filter[fieldName]" pattern
      const match = key.match(/^filter\[(.+)\]$/);
      if (match && value && String(value).trim()) {
        const fieldName = match[1];
        const fieldValue = String(value).trim();

        // Check if this field exists on the entity
        const attr = await this.prisma.entityAttribute.findFirst({
          where: { entityDefinitionId: entityDef.id, name: fieldName },
        });

        if (attr) {
          dataConditions.push({
            data: {
              path: [fieldName],
              string_contains: fieldValue,
            },
          });
        }
      }
    }

    if (dataConditions.length > 0) {
      where.AND = [...(where.AND || []), ...dataConditions];
    }
  }

  const [data, total] = await Promise.all([
    this.prisma.goldenRecord.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { updatedAt: 'desc' },
    }),
    this.prisma.goldenRecord.count({ where }),
  ]);

  return { data, total, page: pageNum, limit: limitNum };
}

  /**
   * Get a single golden record with full details.
   */
  @RequirePermissions('records:read')
  @Get('records/:entityName/:id')
  async getRecord(
    @Req() req: any,
    @Param('entityName') entityName: string,
    @Param('id') id: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const record = await this.prisma.goldenRecord.findFirst({
      where: { id, organizationId: orgId },
      include: {
        sourceRecords: {
          select: { id: true, sourceSystem: true, importDate: true, status: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
        },
      },
    });

    if (!record) throw new NotFoundException('Record not found');

    return record;
  }

  /**
   * Search golden records by a field value.
   */
  @RequirePermissions('records:search')
  @Get('search/:entityName')
  async searchRecords(
    @Req() req: any,
    @Param('entityName') entityName: string,
    @Query('field') field: string,
    @Query('value') value: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: entityName },
    });

    if (!entityDef) return { data: [] };

    // Search in JSONB data field
    const records = await this.prisma.goldenRecord.findMany({
      where: {
        organizationId: orgId,
        entityDefinitionId: entityDef.id,
        status: 'active',
        data: {
          path: [field],
          string_contains: value,
        },
      },
      take: 20,
    });

    return { data: records };
  }

  /**
 * Create a new record for an entity.
 * Checks for duplicates based on form's duplicateConfig before creating.
 */
@Post('records/:entityName')
@RequirePermissions('records:create')
async createRecord(
  @Req() req: any,
  @Param('entityName') entityName: string,
  @Body() dto: { data: Record<string, any> },
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  // Get entity definition
  const entityDef = await this.prisma.entityDefinition.findFirst({
    where: { organizationId: orgId, name: entityName },
  });

  if (!entityDef) {
    throw new BadRequestException(`Entity "${entityName}" not found. Create it first in Settings.`);
  }

  // Find linked form and its duplicate config
  const linkedForm = await this.prisma.formDefinition.findFirst({
    where: {
      organizationId: orgId,
      status: 'published',
      name: { contains: entityName, mode: 'insensitive' },
    },
  });

  const formSchema = (linkedForm?.formSchema as any) || {};

  // Find identifier attributes for fallback + hashed identifier generation
  const identifierAttrs = await this.prisma.entityAttribute.findMany({
    where: { entityDefinitionId: entityDef.id, isIdentifier: true },
  });

  // Get duplicate config from form, or fall back to entity identifiers
  let duplicateConfig = formSchema.duplicateConfig;

  if (!duplicateConfig || !duplicateConfig.identifierFields?.length) {
    if (identifierAttrs.length > 0) {
      duplicateConfig = {
        enabled: true,
        identifierFields: identifierAttrs.map((a) => a.name),
        action: 'block',
      };
    } else {
      duplicateConfig = { enabled: false, identifierFields: [], action: 'block' };
    }
  }

  // ============ DUPLICATE CHECK (using form's duplicateConfig) ============
  if (duplicateConfig.enabled && duplicateConfig.identifierFields?.length > 0) {
    const duplicateChecks: any[] = [];

    for (const fieldName of duplicateConfig.identifierFields) {
      const fieldValue = dto.data[fieldName];
      if (fieldValue && String(fieldValue).trim()) {
        duplicateChecks.push({
          data: { path: [fieldName], equals: String(fieldValue).trim() },
        });
      }
    }

    if (duplicateChecks.length > 0) {
      const existing = await this.prisma.goldenRecord.findFirst({
        where: {
          organizationId: orgId,
          entityDefinitionId: entityDef.id,
          status: 'active',
          deletedAt: null,
          OR: duplicateChecks,
        },
      });

      if (existing) {
        const existingData = existing.data as Record<string, any>;
        const matchedFields = duplicateConfig.identifierFields.filter(
          (f: string) => existingData[f] && dto.data[f] &&
            String(existingData[f]).trim() === String(dto.data[f]).trim()
        );

        if (duplicateConfig.action === 'update') {
          const mergedData = { ...existingData, ...dto.data };
          await this.prisma.goldenRecord.update({
            where: { id: existing.id },
            data: { data: mergedData },
          });
          return {
            success: true,
            message: 'Existing record updated',
            recordId: existing.id,
            action: 'updated',
            matchedFields,
          };
        }

        if (duplicateConfig.action === 'block') {
          throw new BadRequestException({
            message: 'Duplicate record detected',
            errors: [
              `A record with matching ${matchedFields.join(', ')} already exists.`,
            ],
            existingRecordId: existing.id,
            duplicateFields: matchedFields,
            action: 'block',
          });
        }

        // action === 'warn' — fall through to create the record
      }
    }
  }

  // Generate hashed identifier
  let hashedId: string | null = null;
  if (identifierAttrs.length > 0) {
    const idValue = dto.data[identifierAttrs[0].name];
    if (idValue) {
      hashedId = require('crypto')
        .createHash('sha256')
        .update(String(idValue).toLowerCase().trim())
        .digest('hex');
    }
  }

  // Check if an active workflow exists for this entity before creating the record
  // Match workflows that either target this entity specifically OR have no entityName (wildcard)
  const allActiveWorkflows = await this.prisma.workflowDefinition.findMany({
    where: { organizationId: orgId, triggerType: 'event', isActive: true },
    select: { id: true, name: true, triggerConfig: true },
  });

  const matchingWorkflow = allActiveWorkflows.find((wf) => {
    const config = wf.triggerConfig as any;
    return !config.entityName || config.entityName === '*' || config.entityName === entityName;
  }) ?? null;

  // Stamp initial workflow status into the record data
  const recordData = matchingWorkflow
    ? { ...dto.data, _workflowStatus: 'pending', _workflowName: matchingWorkflow.name }
    : dto.data;

  // Create golden record
  const record = await this.prisma.goldenRecord.create({
    data: {
      entityDefinitionId: entityDef.id,
      organizationId: orgId,
      data: recordData,
      hashedIdentifier: hashedId,
      matchConfidence: 1.0,
      status: 'active',
    },
  });

  // Create version 1
  await this.prisma.recordVersion.create({
    data: {
      goldenRecordId: record.id,
      versionNumber: 1,
      dataSnapshot: dto.data,
      changedFields: Object.keys(dto.data),
    },
  });

  // Emit event — workflow engine listener will start the workflow and update status to in_review
  if (matchingWorkflow) {
    try {
      this.eventEmitter.emit('golden_record.created', {
        orgId,
        recordId: record.id,
        entityType: entityName,
        data: dto.data,
      });
    } catch {
      // Don't fail the record creation if workflow event fails
    }
  }

  return {
    ...record,
    workflowStarted: !!matchingWorkflow,
    workflowName: matchingWorkflow?.name ?? null,
  };
}

/**
 * Update a record.
 */
@Put('records/:entityName/:id')
@RequirePermissions('records:update')
async updateRecord(
  @Req() req: any,
  @Param('entityName') entityName: string,
  @Param('id') id: string,
  @Body() dto: { data: Record<string, any> },
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  const record = await this.prisma.goldenRecord.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!record) throw new NotFoundException('Record not found');

  const oldData = record.data as Record<string, any>;
  const newData = { ...oldData, ...dto.data };
  const changedFields = Object.keys(dto.data);

  // Update record
  const updated = await this.prisma.goldenRecord.update({
    where: { id },
    data: {
      data: newData,
      updatedBy: req.user?.sub,
    },
  });

  // Create version
  const versionCount = await this.prisma.recordVersion.count({
    where: { goldenRecordId: id },
  });

  await this.prisma.recordVersion.create({
    data: {
      goldenRecordId: id,
      versionNumber: versionCount + 1,
      dataSnapshot: newData,
      changedFields,
      updatedBy: req.user?.sub,
    },
  });

  this.eventEmitter.emit('golden_record.updated', {
    orgId,
    recordId: id,
    entityType: entityName,
    changedFields,
    userId: req.user?.sub,
    oldData,
    newData: dto.data,
  });

  return updated;
}

/**
 * Soft delete a record.
 */
@Delete('records/:entityName/:id')
@RequirePermissions('records:delete')
async deleteRecord(
  @Req() req: any,
  @Param('entityName') entityName: string,
  @Param('id') id: string,
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  const record = await this.prisma.goldenRecord.findFirst({
    where: { id, organizationId: orgId },
  });

  if (!record) throw new NotFoundException('Record not found');

  await this.prisma.goldenRecord.update({
    where: { id },
    data: { deletedAt: new Date(), status: 'archived' },
  });

  // Emit event for activity feed, timeline, and webhooks
  this.eventEmitter.emit('golden_record.deleted', {
    orgId,
    recordId: id,
    entityType: entityName,
    userId: req.user?.sub,
  });

  return { success: true, message: 'Record deleted' };
}
}