import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateRelationshipDto } from '../dto/create-relationship.dto';

@Injectable()
export class RelationshipService {
  private readonly logger = new Logger(RelationshipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a relationship between two entities.
   * Emits event so timeline is updated for both sides.
   */
  async create(orgId: string, dto: CreateRelationshipDto, userId?: string) {
    // Check for duplicates
    const existing = await this.prisma.recordRelationship.findFirst({
      where: {
        organizationId: orgId,
        sourceEntityType: dto.sourceEntityType,
        sourceRecordId: dto.sourceRecordId,
        targetEntityType: dto.targetEntityType,
        targetRecordId: dto.targetRecordId,
        relationshipType: dto.relationshipType,
      },
    });

    if (existing) {
      throw new ConflictException(`Relationship already exists between ${dto.sourceEntityType}:${dto.sourceRecordId} and ${dto.targetEntityType}:${dto.targetRecordId}`);
    }

    const relationship = await this.prisma.recordRelationship.create({
      data: {
        organizationId: orgId,
        sourceEntityType: dto.sourceEntityType,
        sourceRecordId: dto.sourceRecordId,
        targetEntityType: dto.targetEntityType,
        targetRecordId: dto.targetRecordId,
        relationshipType: dto.relationshipType,
        metadata: dto.metadata || {},
        confidence: dto.confidence ?? 1.0,
        isInferred: false,
      },
    });

    // Emit event for timeline
    this.eventEmitter.emit('relationship.created', {
      orgId,
      sourceEntityType: dto.sourceEntityType,
      sourceRecordId: dto.sourceRecordId,
      targetEntityType: dto.targetEntityType,
      targetRecordId: dto.targetRecordId,
      relationshipType: dto.relationshipType,
      userId,
    });

    this.logger.log(`Relationship created: ${dto.sourceEntityType}:${dto.sourceRecordId} → ${dto.targetEntityType}:${dto.targetRecordId} (${dto.relationshipType})`);

    return relationship;
  }

  /**
   * Get all relationships for an entity (both directions).
   */
  async getRelationships(orgId: string, entityType: string, recordId: string) {
    const [outgoing, incoming] = await Promise.all([
      this.prisma.recordRelationship.findMany({
        where: { organizationId: orgId, sourceEntityType: entityType, sourceRecordId: recordId },
        select: {
          id: true,
          targetEntityType: true,
          targetRecordId: true,
          relationshipType: true,
          metadata: true,
          confidence: true,
          createdAt: true,
        },
      }),
      this.prisma.recordRelationship.findMany({
        where: { organizationId: orgId, targetEntityType: entityType, targetRecordId: recordId },
        select: {
          id: true,
          sourceEntityType: true,
          sourceRecordId: true,
          relationshipType: true,
          metadata: true,
          confidence: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      outgoing,
      incoming,
      total: outgoing.length + incoming.length,
    };
  }

  /**
   * Delete a relationship.
   */
  async delete(orgId: string, relationshipId: string) {
    return this.prisma.recordRelationship.deleteMany({
      where: { id: relationshipId, organizationId: orgId },
    });
  }

  /**
   * Bulk create relationships and/or accept suggestions in a single transaction.
   * Each item can either create a new relationship directly or accept a pending suggestion.
   */
  async createBulk(orgId: string, items: any[], userId?: string) {
    const eventsToEmit: any[] = [];

    const result = await this.prisma.$transaction(async (tx) => {
      let linked = 0;
      let accepted = 0;
      const errors: string[] = [];

      for (const item of items) {
        try {
          if (item.existingSuggestionId) {
            // Accept a pending suggestion
            const suggestion = await tx.suggestion.findFirst({
              where: { id: item.existingSuggestionId, organizationId: orgId, status: 'pending' },
            });
            if (!suggestion) { errors.push(`Suggestion ${item.existingSuggestionId} not found or already resolved`); continue; }

            const action = suggestion.proposedAction as any;

            await tx.recordRelationship.create({
              data: {
                organizationId: orgId,
                sourceEntityType: suggestion.entityTypeA!,
                sourceRecordId: suggestion.entityIdA!,
                targetEntityType: suggestion.entityTypeB!,
                targetRecordId: suggestion.entityIdB!,
                relationshipType: action.relationshipType,
                confidence: suggestion.confidence ?? 1.0,
                isInferred: true,
              },
            });

            await tx.suggestion.update({
              where: { id: item.existingSuggestionId },
              data: { status: 'accepted', resolvedBy: userId, resolvedAt: new Date() },
            });

            accepted++;

            eventsToEmit.push({
              orgId,
              sourceEntityType: suggestion.entityTypeA!,
              sourceRecordId: suggestion.entityIdA!,
              targetEntityType: suggestion.entityTypeB!,
              targetRecordId: suggestion.entityIdB!,
              relationshipType: action.relationshipType,
              userId,
            });
          } else {
            // Check both directions for existing relationship (same-entity-type rules)
            const existing = await tx.recordRelationship.findFirst({
              where: {
                organizationId: orgId,
                relationshipType: item.relationshipType,
                OR: [
                  {
                    sourceEntityType: item.sourceEntityType,
                    sourceRecordId: item.sourceRecordId,
                    targetEntityType: item.targetEntityType,
                    targetRecordId: item.targetRecordId,
                  },
                  {
                    sourceEntityType: item.targetEntityType,
                    sourceRecordId: item.targetRecordId,
                    targetEntityType: item.sourceEntityType,
                    targetRecordId: item.sourceRecordId,
                  },
                ],
              },
            });
            if (existing) { errors.push(`Relationship already exists between ${item.sourceEntityType}:${item.sourceRecordId} and ${item.targetEntityType}:${item.targetRecordId}`); continue; }

            await tx.recordRelationship.create({
              data: {
                organizationId: orgId,
                sourceEntityType: item.sourceEntityType,
                sourceRecordId: item.sourceRecordId,
                targetEntityType: item.targetEntityType,
                targetRecordId: item.targetRecordId,
                relationshipType: item.relationshipType,
                confidence: item.confidence ?? 1.0,
                isInferred: false,
              },
            });

            linked++;

            eventsToEmit.push({
              orgId,
              sourceEntityType: item.sourceEntityType,
              sourceRecordId: item.sourceRecordId,
              targetEntityType: item.targetEntityType,
              targetRecordId: item.targetRecordId,
              relationshipType: item.relationshipType,
              userId,
            });
          }
        } catch (e: any) {
          errors.push(e.message || 'Unknown error');
        }
      }

      return { linked, accepted, errors: errors.length, errorDetails: errors };
    });

    // Emit all events after the transaction commits
    for (const event of eventsToEmit) {
      this.eventEmitter.emit('relationship.created', event);
    }

    this.logger.log(`Bulk: ${result.linked} linked, ${result.accepted} accepted, ${result.errors} errors`);
    return result;
  }

  /**
   * Find all records related to a given entity (graph traversal, 1 level deep).
   */
  async getRelatedRecords(orgId: string, entityType: string, recordId: string) {
    const relationships = await this.getRelationships(orgId, entityType, recordId);

    // Collect all related record IDs
    const relatedIds: { entityType: string; recordId: string; relationshipType: string }[] = [];

    for (const rel of relationships.outgoing) {
      relatedIds.push({
        entityType: rel.targetEntityType,
        recordId: rel.targetRecordId,
        relationshipType: rel.relationshipType,
      });
    }

    for (const rel of relationships.incoming) {
      relatedIds.push({
        entityType: rel.sourceEntityType,
        recordId: rel.sourceRecordId,
        relationshipType: rel.relationshipType,
      });
    }

    // Fetch brief data for each related record
    const records = await Promise.all(
      relatedIds.map(async (r) => {
        const golden = await this.prisma.goldenRecord.findFirst({
          where: { id: r.recordId, organizationId: orgId },
          select: { id: true, data: true, entityDefinitionId: true },
        });
        return {
          entityType: r.entityType,
          recordId: r.recordId,
          relationshipType: r.relationshipType,
          briefData: golden?.data || null,
        };
      }),
    );

    return records;
  }
}