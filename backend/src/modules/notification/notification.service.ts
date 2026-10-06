import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ProviderRegistry } from './adapters/provider-registry';
import { ExpressionEngine } from '../workflow/expression-engine';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistry,
    @InjectQueue('notification-dispatch') private dispatchQueue: Queue,
  ) {}

  /**
   * Listen for notification.send events from workflows.
   */
  @OnEvent('notification.send')
  async onNotificationSend(payload: {
    orgId: string;
    channel: string;
    recipient: string;
    message: string;
    templateId?: string;
    params?: Record<string, any>;
    priority?: number;
    scheduledFor?: Date;
  }) {
    await this.createAndDispatch(payload);
  }

  /**
   * Create a notification record and dispatch it.
   */
  async createAndDispatch(params: {
    orgId: string;
    channel?: string;
    recipient: string;
    message?: string;
    templateId?: string;
    params?: Record<string, any>;
    priority?: number;
    scheduledFor?: Date;
  }) {
    let channel = params.channel || 'in_app';
    let body = params.message || '';
    let subject: string | undefined;

    // If template is provided, render it
    if (params.templateId && params.params) {
      const template = await this.prisma.notificationTemplate.findUnique({
        where: { id: params.templateId },
      });

      if (template) {
        channel = template.channel;
        subject = template.subject
          ? ExpressionEngine.resolve(template.subject, params.params)
          : undefined;
        body = ExpressionEngine.resolve(template.bodyTemplate, params.params);
      }
    }

    // Check user preferences
    const userId = params.recipient;
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { organizationId: params.orgId, userId },
    });

    const category = params.params?.category || 'general';
    const isEnabled = preferences.find(
      (p) => p.channel === channel && (p.category === category || p.category === 'all'),
    );

    if (preferences.length > 0 && isEnabled && !isEnabled.isEnabled) {
      this.logger.log(`Notification suppressed by user preference: ${userId}, ${channel}, ${category}`);
      return;
    }

    // Create notification record
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: params.orgId,
        templateId: params.templateId,
        channel,
        recipient: params.recipient,
        recipientName: params.params?.recipientName,
        subject,
        body,
        params: params.params || {},
        priority: params.priority || 0,
        scheduledFor: params.scheduledFor,
        maxRetries: 3,
      },
    });

    // If scheduled for later, add to delayed queue
    if (params.scheduledFor && params.scheduledFor > new Date()) {
      const delay = params.scheduledFor.getTime() - Date.now();
      await this.dispatchQueue.add('send-notification', { notificationId: notification.id }, { delay });
      return notification;
    }

    // Dispatch immediately
    await this.dispatchQueue.add('send-notification', { notificationId: notification.id });
    return notification;
  }

  /**
   * Dispatch a single notification (called by queue processor).
   */
  async dispatchNotification(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.status === 'sent' || notification.status === 'delivered') {
      return;
    }

    // Find active channel configuration
    // First try default channel, then fall back to any active channel
    let channelConfig = await this.prisma.notificationChannel.findFirst({
      where: {
        organizationId: notification.organizationId,
        channel: notification.channel,
        isActive: true,
        isDefault: true,
      },
    });

    if (!channelConfig) {
      channelConfig = await this.prisma.notificationChannel.findFirst({
        where: {
          organizationId: notification.organizationId,
          channel: notification.channel,
          isActive: true,
        },
      });
    }

    if (!channelConfig) {
      this.logger.warn(`No active channel config for ${notification.channel} in org ${notification.organizationId}`);
      return;
    }

    const config = channelConfig.config as Record<string, any>;
    const provider = this.providerRegistry.getProvider(channelConfig.provider);

    // Update status to sending
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { status: 'queued' },
    });

    // Send
    const result = await provider.send(
      {
        to: notification.recipient,
        subject: notification.subject || undefined,
        body: notification.body,
        metadata: notification.params as any,
      },
      { ...config, orgId: notification.organizationId },
    );

    if (result.success) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          provider: channelConfig.provider,
          providerMessageId: result.providerMessageId,
          sentAt: new Date(),
          deliveredAt: notification.channel === 'in_app' ? new Date() : null,
        },
      });
    } else {
      const updatedNotification = await this.prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (updatedNotification && updatedNotification.retryCount < updatedNotification.maxRetries) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: 'pending',
            retryCount: { increment: 1 },
            errorMessage: result.error,
          },
        });

        // Retry with backoff
        const delay = Math.pow(2, updatedNotification.retryCount) * 1000;
        await this.dispatchQueue.add('send-notification', { notificationId }, { delay });
      } else {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: 'failed',
            errorMessage: result.error,
          },
        });
      }
    }
  }
}