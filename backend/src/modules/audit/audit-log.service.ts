import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('*')
  async logEvent(eventName: string, payload: any) {
    const skipEvents = [
      'audit.log.created', 'scheduler.batch.completed', 'scheduler.job.queued',
      'health.check', 'activity.new',
    ];
    if (skipEvents.includes(eventName)) return;

    const orgId = payload.orgId || payload.organizationId;
    if (!orgId) return;

    try {
      const lastLog = await this.prisma.auditLog.findFirst({
        where: { organizationId: orgId },
        orderBy: { id: 'desc' },
        select: { currentHash: true },
      });

      const { entityType, entityId, oldValues, newValues } = this.extractEntityInfo(eventName, payload);

      await this.prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: payload.userId || payload.actorUserId,
          action: eventName,
          entityType: entityType || 'unknown',
          entityId: entityId || payload.id || payload.recordId,
          oldValues: oldValues || payload.oldValues || payload.before,
          newValues: newValues || payload.newValues || payload.after || payload.data,
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          prevHash: lastLog?.currentHash || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log for ${eventName}: ${error.message}`);
    }
  }

  private extractEntityInfo(eventName: string, payload: any) {
    if (eventName.startsWith('golden_record.')) {
      return {
        entityType: 'golden_record',
        entityId: payload.recordId,
        newValues: payload.data,
        oldValues: eventName === 'golden_record.updated' ? payload.oldData : undefined,
      };
    }
    if (eventName === 'connector.run.completed') {
      return { entityType: 'connector_run', entityId: payload.runId, newValues: { status: 'completed', recordsProcessed: payload.recordsProcessed } };
    }
    if (eventName === 'user.login' || eventName === 'user.logout') {
      return { entityType: 'user_session', entityId: payload.userId, newValues: { action: eventName } };
    }
    return {
      entityType: payload.entityType,
      entityId: payload.entityId || payload.id || payload.recordId,
      newValues: payload.data || payload,
    };
  }

  async getEntityAuditTrail(orgId: string, entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId: orgId, entityType, entityId },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
  }
}
