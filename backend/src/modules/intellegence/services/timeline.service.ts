import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ProfileBuilderService } from './profile-builder.service';

/**
 * Records every significant data change as a timeline event.
 * Listens to application events and creates immutable timeline entries.
 */
@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profileBuilder: ProfileBuilderService,
  ) {}

  /**
   * Create a timeline event.
   */
  async recordEvent(
    orgId: string,
    entityType: string,
    recordId: string,
    eventType: string,
    eventData: Record<string, any>,
    actorUserId?: string,
  ) {
    const event = await this.prisma.recordTimelineEvent.create({
      data: {
        organizationId: orgId,
        entityType,
        recordId,
        eventType,
        eventData,
        actorUserId,
      },
    });

    // Invalidate cached profile (data changed)
    await this.profileBuilder.invalidateCache(orgId, entityType, recordId);

    return event;
  }

  // =====================
  // Event Listeners
  // =====================

  @OnEvent('golden_record.created')
  async onGoldenRecordCreated(payload: {
    orgId: string;
    recordId: string;
    entityType: string;
    data: any;
    userId?: string;
  }) {
    await this.recordEvent(payload.orgId, payload.entityType, payload.recordId, 'record_created', {
      initialData: payload.data,
    }, payload.userId);
  }

  @OnEvent('golden_record.updated')
  async onGoldenRecordUpdated(payload: {
    orgId: string;
    recordId: string;
    entityType: string;
    changedFields: string[];
    userId?: string;
  }) {
    await this.recordEvent(payload.orgId, payload.entityType, payload.recordId, 'field_updated', {
      changedFields: payload.changedFields,
    }, payload.userId);
  }

  @OnEvent('source_record.matched')
  async onSourceRecordMatched(payload: {
    orgId: string;
    recordId: string;
    entityType: string;
    sourceSystem: string;
    userId?: string;
  }) {
    await this.recordEvent(payload.orgId, payload.entityType, payload.recordId, 'connector_imported', {
      sourceSystem: payload.sourceSystem,
    }, payload.userId);
  }

  @OnEvent('relationship.created')
  async onRelationshipCreated(payload: {
    orgId: string;
    sourceEntityType: string;
    sourceRecordId: string;
    targetEntityType: string;
    targetRecordId: string;
    relationshipType: string;
    userId?: string;
  }) {
    // Create timeline events for BOTH sides of the relationship
    await this.recordEvent(payload.orgId, payload.sourceEntityType, payload.sourceRecordId, 'relationship_added', {
      relatedEntity: payload.targetEntityType,
      relatedId: payload.targetRecordId,
      relationshipType: payload.relationshipType,
    }, payload.userId);

    await this.recordEvent(payload.orgId, payload.targetEntityType, payload.targetRecordId, 'relationship_added', {
      relatedEntity: payload.sourceEntityType,
      relatedId: payload.sourceRecordId,
      relationshipType: payload.relationshipType,
    }, payload.userId);
  }

  @OnEvent('golden_record.deleted')
  async onGoldenRecordDeleted(payload: {
    orgId: string;
    recordId: string;
    entityType: string;
    userId?: string;
  }) {
    await this.recordEvent(payload.orgId, payload.entityType, payload.recordId, 'record_deleted', {
      deletedAt: new Date().toISOString(),
    }, payload.userId);
  }

  @OnEvent('form.submitted')
  async onFormSubmitted(payload: {
    orgId: string;
    formId: string;
    submissionId: string;
    entityType?: string;
    entityId?: string;
    userId?: string;
  }) {
    if (payload.entityType && payload.entityId) {
      await this.recordEvent(payload.orgId, payload.entityType, payload.entityId, 'form_submitted', {
        formId: payload.formId,
        submissionId: payload.submissionId,
      }, payload.userId);
    }
  }
}