import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface ActivityPayload {
  orgId: string;
  eventType: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  action: string;
  summary: string;
  details?: Record<string, any>;
  actorUserId?: string;
  actorName?: string;
  severity?: 'info' | 'success' | 'warning' | 'error' | 'critical';
}

@Injectable()
export class ActivityLoggerService {
  private readonly logger = new Logger(ActivityLoggerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Log any activity event and broadcast to subscribers.
   */
  async log(payload: ActivityPayload) {
    const event = await this.prisma.activityEvent.create({
      data: {
        organizationId: payload.orgId,
        eventType: payload.eventType,
        entityType: payload.entityType,
        entityId: payload.entityId,
        entityName: payload.entityName,
        action: payload.action,
        summary: payload.summary,
        details: payload.details || {},
        actorUserId: payload.actorUserId,
        actorName: payload.actorName,
        severity: payload.severity || 'info',
      },
    });

    // Broadcast to subscribers via EventEmitter (for WebSocket push later)
    this.eventEmitter.emit('activity.new', {
      orgId: payload.orgId,
      event,
    });

    return event;
  }

  // =====================
  // Event Listeners — Auto-log every significant system event
  // =====================

  @OnEvent('golden_record.created')
  async onRecordCreated(payload: any) {
    const name = this.extractPersonName(payload.data);
    await this.log({
      orgId: payload.orgId,
      eventType: 'record_created',
      entityType: payload.entityType || 'golden_record',
      entityId: payload.recordId,
      entityName: name,
      action: 'created',
      summary: `${name || 'A new record'} was created`,
      details: { data: payload.data },
      severity: 'info',
    });
  }

  @OnEvent('golden_record.updated')
  async onRecordUpdated(payload: any) {
    // Fetch record name
    const record = await this.prisma.goldenRecord.findUnique({
      where: { id: payload.recordId },
      select: { data: true },
    });
    const name = this.extractPersonName(record?.data);

    await this.log({
      orgId: payload.orgId,
      eventType: 'record_updated',
      entityType: payload.entityType || 'golden_record',
      entityId: payload.recordId,
      entityName: name || 'Record',
      action: 'updated',
      summary: `${name || 'A record'} was updated (${(payload.changedFields || []).join(', ')})`,
      details: { changedFields: payload.changedFields },
      severity: 'info',
    });
  }

  @OnEvent('golden_record.deleted')
  async onRecordDeleted(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'record_deleted',
      entityType: payload.entityType || 'golden_record',
      entityId: payload.recordId,
      entityName: 'Record',
      action: 'deleted',
      summary: `A record was deleted`,
      details: payload,
      severity: 'error',
    });
  }

  @OnEvent('form.submitted')
  async onFormSubmitted(payload: any) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: payload.submissionId },
      include: { formDefinition: true },
    });

    const formName = submission?.formDefinition?.name || 'Unknown form';

    await this.log({
      orgId: payload.orgId,
      eventType: 'form_submitted',
      entityType: 'form_submission',
      entityId: payload.submissionId,
      entityName: `${formName} #${payload.submissionId?.substring(0, 8)}`,
      action: 'submitted',
      summary: `A new ${formName} was submitted`,
      details: { formId: payload.formId, submissionId: payload.submissionId },
      actorUserId: payload.userId,
      severity: 'success',
    });
  }

  @OnEvent('connector.run.completed')
  async onConnectorRunCompleted(payload: any) {
    const run = await this.prisma.connectorRun.findUnique({
      where: { id: payload.runId },
      include: { job: { include: { connector: true } } },
    });

    await this.log({
      orgId: payload.organizationId || payload.orgId,
      eventType: 'connector_run',
      entityType: 'connector',
      entityId: payload.runId,
      entityName: run?.job?.connector?.name || 'Connector',
      action: 'completed',
      summary: `Data import completed: ${run?.recordsSucceeded || 0} records imported from ${run?.job?.connector?.name || 'connector'}`,
      details: {
        recordsProcessed: run?.recordsProcessed,
        recordsSucceeded: run?.recordsSucceeded,
        recordsFailed: run?.recordsFailed,
      },
      severity: run?.recordsFailed ? 'warning' : 'success',
    });
  }

  @OnEvent('workflow.started')
  async onWorkflowStarted(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'workflow_started',
      entityType: 'workflow',
      entityId: payload.instanceId,
      entityName: payload.workflowName || 'Workflow',
      action: 'started',
      summary: `Workflow "${payload.workflowName}" started`,
      details: payload,
      severity: 'info',
    });
  }

  @OnEvent('workflow.completed')
  async onWorkflowCompleted(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'workflow_completed',
      entityType: 'workflow',
      entityId: payload.instanceId,
      entityName: payload.workflowName || 'Workflow',
      action: 'completed',
      summary: `Workflow "${payload.workflowName}" completed`,
      details: payload,
      severity: 'success',
    });
  }

  @OnEvent('task.assigned')
  async onTaskAssigned(payload: any) {
    const assignee = await this.prisma.user.findUnique({
      where: { id: payload.assigneeId },
      select: { firstName: true, lastName: true },
    });

    const assigneeName = assignee ? `${assignee.firstName} ${assignee.lastName}` : 'User';

    await this.log({
      orgId: payload.orgId,
      eventType: 'task_assigned',
      entityType: 'task',
      entityId: payload.taskId,
      entityName: payload.taskName,
      action: 'assigned',
      summary: `Task "${payload.taskName}" assigned to ${assigneeName}`,
      details: payload,
      actorUserId: payload.assigneeId,
      actorName: assigneeName,
      severity: 'info',
    });
  }

  @OnEvent('task.completed')
  async onTaskCompleted(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'task_completed',
      entityType: 'task',
      entityId: payload.taskId,
      entityName: payload.taskName,
      action: payload.action || 'completed',
      summary: `Task "${payload.taskName}" ${payload.action || 'completed'}`,
      details: payload,
      actorUserId: payload.userId,
      severity: 'success',
    });
  }

  @OnEvent('suggestion.created')
  async onSuggestionCreated(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'suggestion_created',
      entityType: 'suggestion',
      entityId: payload.suggestionId,
      entityName: payload.title || 'Suggestion',
      action: 'detected',
      summary: payload.title || 'New suggestion detected',
      details: payload,
      severity: payload.confidence > 0.85 ? 'warning' : 'info',
    });
  }

  @OnEvent('suggestion.accepted')
  async onSuggestionAccepted(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'suggestion_resolved',
      entityType: 'suggestion',
      entityId: payload.suggestionId,
      entityName: 'Suggestion',
      action: 'accepted',
      summary: 'A suggestion was accepted',
      details: payload,
      actorUserId: payload.userId,
      severity: 'success',
    });
  }

  @OnEvent('relationship.created')
  async onRelationshipCreated(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'relationship_created',
      entityType: 'relationship',
      entityId: payload.sourceRecordId,
      entityName: `${payload.sourceEntityType} → ${payload.targetEntityType}`,
      action: 'linked',
      summary: `New relationship: ${payload.relationshipType}`,
      details: payload,
      severity: 'info',
    });
  }

  @OnEvent('alert.triggered')
  async onAlertTriggered(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'alert_triggered',
      entityType: 'alert',
      entityId: payload.widgetId,
      entityName: payload.widgetName || 'Dashboard widget',
      action: 'triggered',
      summary: `🚨 ${payload.message}`,
      details: payload,
      severity: payload.severity || 'warning',
    });
  }

  @OnEvent('export.completed')
  async onExportCompleted(payload: any) {
    await this.log({
      orgId: payload.orgId,
      eventType: 'export_completed',
      entityType: 'export',
      entityId: payload.exportId,
      entityName: payload.entityName || 'Export',
      action: 'exported',
      summary: `${payload.entityName || 'Data'} exported as ${payload.format}`,
      details: payload,
      actorUserId: payload.userId,
      severity: 'info',
    });
  }

  // =====================
  // Helpers
  // =====================

  private extractPersonName(data: any): string {
    if (!data) return '';
    const d = data as Record<string, any>;
    const name = `${d.first_name || ''} ${d.last_name || ''}`.trim();
    return name || d.name || '';
  }
}