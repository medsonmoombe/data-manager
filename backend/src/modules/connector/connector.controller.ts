import { Controller, Get, Post, Put, Delete, Param, Body, Req, BadRequestException, Logger, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConnectorCrudService } from './services/connector-crud.service';
import { ConnectorService } from './connector.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { Connector } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { getErrorMessage } from '../../common/errorHandler';

@Controller('connectors')
export class ConnectorController {
  private readonly logger = new Logger(ConnectorController.name);

  constructor(
    private readonly crudService: ConnectorCrudService,
    private readonly connectorService: ConnectorService,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly schedulerService: SchedulerService,
    private readonly minioService: MinioService,
  ) {}

  // @RequirePermissions('connectors:manage')
  @Get()
  async findAll(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.crudService.findAll(orgId);
  }

  // @RequirePermissions('connectors:manage')
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.crudService.findOne(orgId, id);
  }

  // @RequirePermissions('connectors:manage')
  @Post()
  async create(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.crudService.create(orgId, dto);
  }

  // @RequirePermissions('connectors:manage')
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.crudService.delete(orgId, id);
  }

  // --- Jobs ---

  // @RequirePermissions('connectors:manage')
  @Post(':id/jobs')
  async createJob(@Param('id') connectorId: string, @Body() dto: any) {
    return this.prisma.connectorJob.create({
      data: { ...dto, connectorId },
    });
  }

  // @RequirePermissions('connectors:manage')
  @Get(':id/jobs')
  async getJobs(@Param('id') connectorId: string) {
    return this.prisma.connectorJob.findMany({
      where: { connectorId },
    });
  }

  // --- Execute ---

  // @RequirePermissions('connectors:manage')
  @Post('jobs/:jobId/run')
  async runJob(@Param('jobId') jobId: string, @Req() req: any) {
    const userId = req.user?.sub;
    try {
      const runId = await this.connectorService.executeJob(jobId, userId);
      return { success: true, runId };
    } catch (err: unknown) {
      throw new BadRequestException((err as Error).message);
    }
  }

  // --- Runs ---

  // @RequirePermissions('connectors:manage')
  @Get('jobs/:jobId/runs')
  async getRuns(@Param('jobId') jobId: string) {
    return this.connectorService.getRuns(jobId);
  }

  // @RequirePermissions('connectors:manage')
  @Get('runs/:runId/items')
  async getRunItems(@Param('runId') runId: string) {
    return this.connectorService.getRunItems(runId);
  }

  // --- File Upload ---

  @Post('upload')
  @RequirePermissions('connectors:create')
  @UseInterceptors(FileInterceptor('file'))
  async uploadConnectorFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const { url, path, size } = await this.minioService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      { uploadedBy: req.user.sub, organizationId: orgId },
    );

    const connector = await this.prisma.connector.create({
      data: {
        organizationId: orgId,
        name: file.originalname,
        connectorType: 'csv',
        configuration: {
          filePath: path,
          fileName: file.originalname,
          fileSize: size,
          fileUrl: url,
        },
      },
    });

    return { connector, fileUrl: url, path };
  }

  // --- Scheduling ---

  // @RequirePermissions('connectors:manage')
  @Post('jobs/:jobId/schedule')
  async scheduleJob(@Param('jobId') jobId: string, @Body() body: { enabled: boolean; cronExpression?: string }) {
    return this.schedulerService.updateSchedule(jobId, body.enabled, body.cronExpression);
  }

  // @RequirePermissions('connectors:manage')
  @Get('jobs/upcoming')
  async getUpcomingRuns(@Req() req: any) {
    const orgId = req.user.orgId;
    return this.schedulerService.getUpcomingRuns(orgId);
  }

  // @RequirePermissions('connectors:manage')
  @Post('jobs/:jobId/trigger')
  async triggerJobNow(@Param('jobId') jobId: string, @Req() req: any) {
    const userId = req.user?.sub;
    await this.schedulerService.triggerJobNow(jobId, userId);
    return { message: 'Job queued for execution' };
  }

  // @RequirePermissions('connectors:manage')
  @Post('jobs/:jobId/pause')
  async pauseJob(@Param('jobId') jobId: string) {
    await this.schedulerService.pauseJob(jobId);
    return { message: 'Job paused' };
  }

  // @RequirePermissions('connectors:manage')
  @Post('jobs/:jobId/resume')
  async resumeJob(@Param('jobId') jobId: string) {
    await this.schedulerService.resumeJob(jobId);
    return { message: 'Job resumed' };
  }

  // --- Adapter info ---

  // @RequirePermissions('connectors:manage')
  @Get('meta/supported-types')
  getSupportedTypes() {
    return { types: this.adapterRegistry.getSupportedTypes() };
  }

  /**
 * Upload and import CSV data directly.
 * Checks for duplicates before creating records.
 */
@Post('import-csv')
@RequirePermissions('connectors:run')
async importCsv(
  @Req() req: any,
  @Body() dto: {
    entityName: string;
    csvContent: string;
    fileName: string;
    transformationRules: any[];
  },
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  try {
    // ============================================================
    // STEP 1: LOAD ENTITY DEFINITION
    // ============================================================
    const entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId: orgId, name: dto.entityName },
      include: { attributes: true },
    });

    if (!entityDef) {
      throw new BadRequestException(`Entity "${dto.entityName}" not found`);
    }

    if (entityDef.attributes.length === 0) {
      throw new BadRequestException(
        `Entity "${dto.entityName}" has no attributes defined. Please add fields before importing.`,
      );
    }

    const validFieldNames    = entityDef.attributes.map(a => a.name);
    const requiredFieldNames = entityDef.attributes.filter(a => a.isRequired).map(a => a.name);

    // ============================================================
    // STEP 2: PARSE & VALIDATE CSV STRUCTURE
    // ============================================================
    const lines = dto.csvContent
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    const headers    = this.parseCSVLine(lines[0]);
    const rules      = dto.transformationRules || [];

    // Build source→target field mapping from transformation rules
    const mapping: Record<string, string> = {};
    rules.forEach((r: any) => {
      if (r.sourceField && r.targetField) mapping[r.sourceField] = r.targetField;
    });

    // Resolve each CSV header to a target field name
    const mappedFields = headers.map(
      header => mapping[header] ?? header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
    );

    // ── Invalid fields: mapped target not in entity ──────────────
    const invalidFields = mappedFields.filter(f => !validFieldNames.includes(f));
    const unrecognizedHeaders = headers.filter((_, idx) => !validFieldNames.includes(mappedFields[idx]));

    if (invalidFields.length > 0) {
      throw new BadRequestException({
        message: 'CSV contains columns that do not match the entity definition',
        errors: [
          `Unrecognized CSV headers: ${unrecognizedHeaders.join(', ')}`,
          `They resolved to invalid field names: ${invalidFields.join(', ')}`,
          `Valid fields for "${dto.entityName}": ${validFieldNames.join(', ')}`,
          'Fix the CSV headers or add transformation rules to map them correctly.',
        ],
        validFields: validFieldNames,
        invalidFields,
        unrecognizedHeaders,
      });
    }

    // ── Duplicate headers in the CSV itself ──────────────────────
    const headerCount: Record<string, number> = {};
    headers.forEach(h => { headerCount[h] = (headerCount[h] || 0) + 1; });
    const duplicateHeaders = Object.entries(headerCount)
      .filter(([, count]) => count > 1)
      .map(([h]) => h);

    if (duplicateHeaders.length > 0) {
      throw new BadRequestException({
        message: 'CSV has duplicate column headers',
        errors: [`Duplicate headers: ${duplicateHeaders.join(', ')}. Each column name must be unique.`],
        duplicateHeaders,
      });
    }

    // ── Missing required fields ──────────────────────────────────
    const missingRequired = requiredFieldNames.filter(f => !mappedFields.includes(f));

    if (missingRequired.length > 0) {
      throw new BadRequestException({
        message: 'CSV is missing required fields',
        errors: [
          `Missing required fields: ${missingRequired.join(', ')}`,
          `All required fields: ${requiredFieldNames.join(', ')}`,
          `Your CSV headers map to: ${mappedFields.join(', ')}`,
        ],
        requiredFields: requiredFieldNames,
        missingFields: missingRequired,
        csvHeaders: headers,
        mappedFields,
      });
    }

    // ── Completely empty CSV data ────────────────────────────────
    const dataLines = lines.slice(1).filter(l => l.replace(/,/g, '').trim().length > 0);
    if (dataLines.length === 0) {
      throw new BadRequestException('CSV has a header row but all data rows are empty');
    }

    // ============================================================
    // STEP 3: RESOLVE DUPLICATE ACTION FROM LINKED FORM
    // ============================================================
    let duplicateAction = 'block'; // default: block duplicates
    try {
      const linkedForm = await this.prisma.formDefinition.findFirst({
        where: {
          organizationId: orgId,
          status: 'published',
          name: { contains: dto.entityName, mode: 'insensitive' },
        },
        select: { formSchema: true },
      });
      if (linkedForm) {
        const schema = (linkedForm.formSchema as any) || {};
        if (schema.duplicateConfig?.action) duplicateAction = schema.duplicateConfig.action;
      }
    } catch { /* use default */ }

    // ============================================================
    // STEP 4: PROCESS ROWS
    // ============================================================
    const results = {
      newRecords:        0,
      updatedRecords:    0,
      blockedDuplicates: 0,
      errors:            [] as string[],
    };

    for (let i = 1; i < lines.length; i++) {
      // Skip blank rows silently
      if (!lines[i].replace(/,/g, '').trim()) continue;

      try {
        const values  = this.parseCSVLine(lines[i]);
        const rowData: Record<string, any> = {};

        headers.forEach((header: string, idx: number) => {
          const targetField = mapping[header] ?? header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
          const rule  = rules.find((r: any) => r.sourceField === header);
          let value: any = values[idx] ?? '';

          // Apply transform
          if (rule?.transform === 'trim')      value = String(value).trim();
          else if (rule?.transform === 'uppercase') value = String(value).toUpperCase();
          else if (rule?.transform === 'lowercase') value = String(value).toLowerCase();
          else if (rule?.transform === 'number')    value = isNaN(Number(value)) ? value : Number(value);
          else value = String(value).trim(); // default: always trim

          rowData[targetField] = value;
        });

        // ── Per-row required field check ─────────────────────────
        const missingInRow = requiredFieldNames.filter(
          f => rowData[f] === undefined || rowData[f] === null || rowData[f] === '',
        );
        if (missingInRow.length > 0) {
          results.errors.push(`Row ${i}: missing required field(s): ${missingInRow.join(', ')}`);
          continue;
        }

        // ── Duplicate detection ───────────────────────────────────
        const populatedFields = Object.entries(rowData)
          .filter(([, v]) => v !== '' && v !== null && v !== undefined)
          .map(([k]) => k);

        let existingRecord: any = null;

        if (populatedFields.length >= 2) {
          const conditions = populatedFields.map(field => ({
            data: {
              path: [field],
              equals: String(rowData[field]).trim(),
            },
          }));

          const potentialMatches = await this.prisma.goldenRecord.findMany({
            where: {
              organizationId: orgId,
              entityDefinitionId: entityDef.id,
              status: 'active',
              deletedAt: null,
              OR: conditions,
            },
            select: { id: true, data: true },
          });

          for (const record of potentialMatches) {
            const recordData = record.data as Record<string, any>;
            let matchCount = 0;

            for (const field of populatedFields) {
              const incoming = String(rowData[field]  ?? '').trim().toLowerCase();
              const existing = String(recordData[field] ?? '').trim().toLowerCase();
              if (incoming && existing && incoming === existing) matchCount++;
            }

            // Require at least 2 field matches to flag as duplicate
            if (matchCount >= 2) { existingRecord = record; break; }
          }
        }

        // ── Handle duplicate or create new ───────────────────────
        if (existingRecord) {
          if (duplicateAction === 'update') {
            await this.prisma.goldenRecord.update({
              where: { id: existingRecord.id },
              data: { data: { ...(existingRecord.data as any), ...rowData }, updatedAt: new Date() },
            });
            results.updatedRecords++;
            this.eventEmitter.emit('golden_record.updated', {
              orgId,
              recordId: existingRecord.id,
              entityType: dto.entityName,
              changedFields: Object.keys(rowData),
              data: { ...(existingRecord.data as any), ...rowData },
            });
          } else if (duplicateAction === 'warn') {
            // Insert anyway but flag it
            const warnedRecord = await this.prisma.goldenRecord.create({
              data: {
                organizationId: orgId,
                entityDefinitionId: entityDef.id,
                data: rowData,
                matchConfidence: 0.5,
                status: 'active',
              },
            });
            results.newRecords++;
            this.eventEmitter.emit('golden_record.created', {
              orgId,
              recordId: warnedRecord.id,
              entityType: dto.entityName,
              data: rowData,
            });
          } else {
            // 'block' — skip silently, count it
            results.blockedDuplicates++;
          }
          continue;
        }

        // Clean insert
        const createdRecord = await this.prisma.goldenRecord.create({
          data: {
            organizationId: orgId,
            entityDefinitionId: entityDef.id,
            data: rowData,
            matchConfidence: 1.0,
            status: 'active',
          },
        });
        results.newRecords++;

        // Emit workflow event for each new record
        this.eventEmitter.emit('golden_record.created', {
          orgId,
          recordId: createdRecord.id,
          entityType: dto.entityName,
          data: rowData,
        });

      } catch (rowError: unknown) {
        const msg = rowError instanceof Error ? rowError.message : String(rowError);
        results.errors.push(`Row ${i}: ${msg}`);
      }
    }

    // ============================================================
    // STEP 5: ACTIVITY LOG + RESPONSE
    // ============================================================
    await this.prisma.activityEvent.create({
      data: {
        organizationId: orgId,
        eventType:  'connector_run',
        entityType: 'connector',
        entityName: dto.fileName,
        action:     'completed',
        summary:    `Import: ${results.newRecords} new, ${results.updatedRecords} updated, ${results.blockedDuplicates} blocked`,
        details:    results,
        severity:   results.errors.length > 0 ? 'warning' : 'success',
      },
    });

    const total  = lines.length - 1;
    const parts: string[] = [];
    if (results.newRecords        > 0) parts.push(`${results.newRecords} record(s) imported`);
    if (results.updatedRecords    > 0) parts.push(`${results.updatedRecords} record(s) updated`);
    if (results.blockedDuplicates > 0) parts.push(`${results.blockedDuplicates} duplicate(s) blocked — already exist in the database`);
    if (results.errors.length     > 0) parts.push(`${results.errors.length} row(s) failed`);
    const msg = parts.length > 0 ? parts.join('. ') + '.' : 'No data was processed.';

    return {
      success: true,
      message: msg,
      stats: {
        totalRows:         total,
        newRecords:        results.newRecords,
        updatedRecords:    results.updatedRecords,
        blockedDuplicates: results.blockedDuplicates,
        skipped:           results.blockedDuplicates,
        errors:            results.errors.length,
      },
      errors: results.errors.slice(0, 10), // surface up to 10 row errors
    };

  } catch (error: unknown) {
    if (error instanceof BadRequestException) throw error;
    this.logger.error('Import failed:', error);
    throw new BadRequestException(
      error instanceof Error ? error.message : 'Import failed due to an unexpected error',
    );
  }
}

/**
 * Preview what would be imported without actually saving.
 */
@Post('import-csv/preview')
@RequirePermissions('connectors:run')
async previewImportCsv(
  @Req() req: any,
  @Body() dto: {
    entityName: string;
    csvContent: string;
    fileName: string;
    transformationRules: any[];
  },
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];

  const entityDef = await this.prisma.entityDefinition.findFirst({
    where: { organizationId: orgId, name: dto.entityName },
    include: { attributes: true },
  });

  if (!entityDef) throw new BadRequestException(`Entity "${dto.entityName}" not found`);

  const lines = dto.csvContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) throw new BadRequestException('CSV must have header and data rows');

  const headers = this.parseCSVLine(lines[0]);
  const rules = dto.transformationRules || [];
  const mapping: Record<string, string> = {};
  rules.forEach((r: any) => {
    if (r.sourceField && r.targetField) mapping[r.sourceField] = r.targetField;
  });

  const previewRows: any[] = [];
  let duplicates = 0;
  let newRecords = 0;

  const identifierAttrs = (entityDef.attributes || []).filter(a => a.isIdentifier);
  const existingRecords = identifierAttrs.length > 0
    ? await this.prisma.goldenRecord.findMany({
        where: { organizationId: orgId, entityDefinitionId: entityDef.id, status: 'active', deletedAt: null },
        select: { id: true, data: true },
      })
    : [];

  for (let i = 1; i < Math.min(lines.length, 21); i++) {
    const values = this.parseCSVLine(lines[i]);
    const rowData: Record<string, any> = {};

    headers.forEach((header, idx) => {
      const targetField = mapping[header] || header.toLowerCase().replace(/\s+/g, '_');
      const rule = rules.find((r: any) => r.sourceField === header);
      let value: any = values[idx] || '';
      if (rule?.transform === 'trim') value = String(value).trim();
      else if (rule?.transform === 'uppercase') value = String(value).toUpperCase();
      else if (rule?.transform === 'lowercase') value = String(value).toLowerCase();
      else if (rule?.transform === 'number') value = isNaN(Number(value)) ? value : Number(value);
      rowData[targetField] = value;
    });

    let isDuplicate = false;
    if (identifierAttrs.length > 0 && existingRecords.length > 0) {
      for (const record of existingRecords) {
        const recordData = record.data as Record<string, any>;
        let matchCount = 0;
        for (const attr of identifierAttrs) {
          if (rowData[attr.name] && recordData[attr.name] &&
              String(rowData[attr.name]).trim().toLowerCase() === String(recordData[attr.name]).trim().toLowerCase()) {
            matchCount++;
          }
        }
        if (matchCount > 0 && identifierAttrs.filter(a => rowData[a.name]).every(a => matchCount >= 1)) {
          isDuplicate = true;
          break;
        }
      }
    }

    previewRows.push({ row: i, data: rowData, status: isDuplicate ? 'duplicate' : 'new' });
    if (isDuplicate) duplicates++;
    else newRecords++;
  }

  return {
    totalRows: lines.length - 1,
    previewRows,
    summary: {
      newRecords,
      duplicates,
      totalPreviewed: previewRows.length,
      estimatedNew: Math.round((newRecords / (previewRows.length || 1)) * (lines.length - 1)),
    },
    headers,
    mappedFields: headers.map(h => mapping[h] || h.toLowerCase().replace(/\s+/g, '_')),
  };
}

/**
 * Parse a single CSV line handling quoted fields.
 */
private parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
}