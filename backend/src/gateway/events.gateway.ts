import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedSocket extends Socket {
  data: {
    orgId?: string;
    userId?: string;
    rooms: Set<string>;
  };
}

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/events',
  transports: ['websocket', 'polling'],
})
@Injectable()
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly connections = new Map<string, AuthenticatedSocket>();

  constructor(private readonly configService: ConfigService) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client.handshake);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.decodeToken(token);
      if (!payload) {
        client.disconnect();
        return;
      }

      client.data.orgId = payload.orgId;
      client.data.userId = payload.sub;
      client.data.rooms = new Set();

      const orgRoom = `org:${payload.orgId}`;
      client.join(orgRoom);
      client.data.rooms.add(orgRoom);

      this.connections.set(client.id, client);
      client.emit('connected', { status: 'ok', timestamp: new Date() });
      this.logger.log(`Client ${client.id} connected (org: ${payload.orgId})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connections.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('subscribe:record')
  handleRecordSubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { recordId: string; entityType: string },
  ) {
    const room = `record:${data.entityType}:${data.recordId}`;
    client.join(room);
    client.data.rooms.add(room);
    client.emit('subscribed', { room, status: 'ok' });
  }

  @SubscribeMessage('unsubscribe:record')
  handleRecordUnsubscription(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { recordId: string; entityType: string },
  ) {
    const room = `record:${data.entityType}:${data.recordId}`;
    client.leave(room);
    client.data.rooms.delete(room);
    client.emit('unsubscribed', { room, status: 'ok' });
  }

  @OnEvent('golden_record.created')
  onGoldenRecordCreated(payload: any) {
    this.broadcastToOrg(payload.orgId, 'golden_record.created', {
      recordId: payload.recordId, entityType: payload.entityType, data: payload.data, timestamp: new Date(),
    });
    this.broadcastToRoom(`record:${payload.entityType}:${payload.recordId}`, 'record.updated', {
      event: 'created', recordId: payload.recordId, data: payload.data,
    });
  }

  @OnEvent('golden_record.updated')
  onGoldenRecordUpdated(payload: any) {
    this.broadcastToOrg(payload.orgId, 'golden_record.updated', {
      recordId: payload.recordId, entityType: payload.entityType, changedFields: payload.changedFields, timestamp: new Date(),
    });
    this.broadcastToRoom(`record:${payload.entityType}:${payload.recordId}`, 'record.updated', {
      event: 'updated', recordId: payload.recordId, changedFields: payload.changedFields,
    });
  }

  @OnEvent('connector.run.completed')
  onConnectorRunCompleted(payload: any) {
    this.broadcastToOrg(payload.orgId, 'connector.run.completed', {
      runId: payload.runId, jobId: payload.jobId, recordsProcessed: payload.recordsProcessed, status: payload.status, timestamp: new Date(),
    });
  }

  @OnEvent('workflow.task.created')
  onWorkflowTaskCreated(payload: any) {
    this.broadcastToOrg(payload.orgId, 'workflow.task.created', {
      taskId: payload.taskId, instanceId: payload.instanceId, stepName: payload.stepName, timestamp: new Date(),
    });
    if (payload.assigneeId) {
      this.broadcastToUser(payload.assigneeId, 'workflow.task.assigned', {
        taskId: payload.taskId, stepName: payload.stepName, dueDate: payload.dueDate,
      });
    }
  }

  @OnEvent('suggestion.created')
  onSuggestionCreated(payload: any) {
    this.broadcastToOrg(payload.orgId, 'suggestion.created', {
      suggestionId: payload.suggestionId, type: payload.suggestionType, confidence: payload.confidence, timestamp: new Date(),
    });
  }

  @OnEvent('notification.send')
  onNotificationSend(payload: any) {
    if (payload.userId && payload.channel === 'in_app') {
      this.broadcastToUser(payload.userId, 'notification.received', {
        id: payload.notificationId, title: payload.title, message: payload.message, type: payload.type, timestamp: new Date(),
      });
    }
  }

  private broadcastToOrg(orgId: string, event: string, data: any) {
    this.server?.to(`org:${orgId}`).emit(event, data);
  }

  private broadcastToRoom(room: string, event: string, data: any) {
    this.server?.to(room).emit(event, data);
  }

  private broadcastToUser(userId: string, event: string, data: any) {
    for (const [, client] of this.connections) {
      if (client.data.userId === userId) {
        client.emit(event, data);
      }
    }
  }

  private extractToken(handshake: any): string | null {
    const auth = handshake.auth?.token || handshake.headers?.authorization;
    if (!auth) return null;
    return auth.startsWith('Bearer ') ? auth.substring(7) : auth;
  }

  private decodeToken(token: string): { orgId: string; sub: string } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      return { orgId: payload.orgId || payload.azp, sub: payload.sub };
    } catch {
      return null;
    }
  }
}
