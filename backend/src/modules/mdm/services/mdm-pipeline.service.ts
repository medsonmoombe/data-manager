import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MatchingEngineService } from './matching-engine.service';

@Injectable()
export class MdmPipelineService {
  private readonly logger = new Logger(MdmPipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchingEngine: MatchingEngineService,
  ) {}

  /**
   * Listen for completed connector runs and process them.
   */
  @OnEvent('connector.run.completed')
  async handleConnectorRunCompleted(payload: {
    runId: string;
    jobId: string;
    targetEntity: string;
    organizationId: string;
  }) {
    this.logger.log(`MDM Pipeline received connector.run.completed for run ${payload.runId}`);
    await this.processRun(payload.runId, payload.targetEntity, payload.organizationId);
  }

  /**
   * Process all items from a completed connector run.
   */
  async processRun(runId: string, targetEntity: string, organizationId: string) {
    // Get or create the entity definition
    const entityDef = await this.getOrCreateEntityDefinition(organizationId, targetEntity);

    // Get all processed run items
    const items = await this.prisma.connectorRunItem.findMany({
      where: {
        runId,
        status: 'processed',  // Only process successfully transformed items
      },
    });

    this.logger.log(`Processing ${items.length} items for entity ${targetEntity}`);

    // Create source records
    for (const item of items) {
      const rawData = item.rawData as Record<string, any>;

      // Get the connector name for source system
      const run = await this.prisma.connectorRun.findUnique({
        where: { id: runId },
        include: {
          job: {
            include: { connector: true },
          },
        },
      });

      const sourceSystem = run?.job?.connector?.name || 'unknown';

      // Create source record
      const sourceRecord = await this.prisma.sourceRecord.create({
        data: {
          connectorRunItemId: item.id,
          entityDefinitionId: entityDef.id,
          sourceData: rawData,
          sourceSystem,
          sourceId: rawData.sourceId || rawData.id || undefined,
          status: 'pending',
        },
      });

      // Run matching
      try {
        await this.matchingEngine.matchSourceRecord(sourceRecord.id, organizationId);
      } catch (err: unknown) {
        this.logger.error(`Failed to match source record ${sourceRecord.id}: ${(err as Error).message}`);
        await this.prisma.sourceRecord.update({
          where: { id: sourceRecord.id },
          data: { status: 'rejected' },
        });
      }
    }

    this.logger.log(`MDM pipeline completed for run ${runId}: ${items.length} items processed`);
  }

  /**
   * Get or create an entity definition.
   * Auto-creates basic attributes if creating new.
   */
  private async getOrCreateEntityDefinition(organizationId: string, entityName: string) {
    let entityDef = await this.prisma.entityDefinition.findFirst({
      where: { organizationId, name: entityName },
    });

    if (!entityDef) {
      entityDef = await this.prisma.entityDefinition.create({
        data: {
          organizationId,
          name: entityName,
          description: `Auto-created from connector job`,
        },
      });

      this.logger.log(`Created entity definition: ${entityName}`);
    }

    return entityDef;
  }
}