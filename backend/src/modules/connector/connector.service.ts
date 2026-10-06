import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdapterRegistry } from './adapters/adapter-registry';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ConnectorService {
  private readonly logger = new Logger(ConnectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Execute a connector job manually.
   */
  async executeJob(jobId: string, userId?: string): Promise<string> {
    // Get the job with its connector
    const job = await this.prisma.connectorJob.findUnique({
      where: { id: jobId },
      include: { connector: true },
    });

    if (!job) throw new Error(`Job not found: ${jobId}`);
    if (!job.isActive) throw new Error(`Job is inactive: ${jobId}`);

    // Create a run record
    const run = await this.prisma.connectorRun.create({
      data: {
        jobId: job.id,
        startedAt: new Date(),
        status: 'running',
        startedBy: userId,
      },
    });

    try {
      // Get the adapter
      const adapter = this.adapterRegistry.getAdapter(job.connector.connectorType);

      // Fetch data
      const config = job.connector.configuration as Record<string, any>;
      const result = await adapter.fetch(config);

      // Apply transformation rules and create run items
      const rules = job.transformationRules as any[];
      let succeeded = 0;
      let failed = 0;

      for (const record of result.records) {
        try {
          const transformed = this.applyTransformation(record, rules);

          await this.prisma.connectorRunItem.create({
            data: {
              runId: run.id,
              sourceIdentifier: transformed?.sourceId || record.id || undefined,
              rawData: transformed,
              status: 'processed',
            },
          });
          succeeded++;
        } catch (err: unknown) {
          const error = err as Error;
          await this.prisma.connectorRunItem.create({
            data: {
              runId: run.id,
              sourceIdentifier: record.id || undefined,
              rawData: record,
              status: 'error',
              errorMessage: error.message,
            },
          });
          failed++;
        }
      }

      // Update run
      await this.prisma.connectorRun.update({
        where: { id: run.id },
        data: {
          status: failed === 0 ? 'success' : 'partial',
          completedAt: new Date(),
          recordsProcessed: result.totalFetched,
          recordsSucceeded: succeeded,
          recordsFailed: failed,
        },
      });

      // Update job last run
      await this.prisma.connectorJob.update({
        where: { id: jobId },
        data: { lastRunAt: new Date() },
      });

      // Emit event for MDM pipeline (Phase 2 will listen to this)
      this.eventEmitter.emit('connector.run.completed', {
        runId: run.id,
        jobId: job.id,
        targetEntity: job.targetEntity,
        organizationId: job.connector.organizationId,
      });

      return run.id;
    } catch (err: unknown) {
      const error = err as Error;
      // Mark run as failed
      await this.prisma.connectorRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorLog: { message: error.message, stack: error.stack },
        },
      });
      throw err;
    }
  }

  /**
   * Apply transformation rules to a raw record.
   * Rules are defined as: [{ sourceField, targetField, defaultValue, transform }]
   */
  private applyTransformation(record: Record<string, any>, rules: any[]): Record<string, any> {
    if (!rules || rules.length === 0) {
      // No rules: pass through all fields
      return { ...record };
    }

    const result: Record<string, any> = {};

    for (const rule of rules) {
      const { sourceField, targetField, defaultValue, transform } = rule;
      let value = sourceField ? record[sourceField] : undefined;

      // Apply default if missing
      if (value === undefined || value === null) {
        value = defaultValue;
      }

      // Apply transformation function
      if (transform === 'trim' && typeof value === 'string') {
        value = value.trim();
      } else if (transform === 'uppercase' && typeof value === 'string') {
        value = value.toUpperCase();
      } else if (transform === 'lowercase' && typeof value === 'string') {
        value = value.toLowerCase();
      } else if (transform === 'number' && !isNaN(Number(value))) {
        value = Number(value);
      } else if (transform === 'date' && value) {
        value = new Date(value).toISOString();
      }

      // Set in result using targetField or sourceField
      const key = targetField || sourceField;
      if (key) {
        result[key] = value;
      }
    }

    // Always include sourceId for lineage
    result.sourceId = record.id || record.source_id || undefined;

    return result;
  }

  /**
   * Get all runs for a job.
   */
  async getRuns(jobId: string, limit = 20) {
    return this.prisma.connectorRun.findMany({
      where: { jobId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all run items for a run.
   */
  async getRunItems(runId: string, page = 1, pageSize = 50) {
    return this.prisma.connectorRunItem.findMany({
      where: { runId },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }
}