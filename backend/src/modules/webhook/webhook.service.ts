import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import axios, { AxiosError } from 'axios';
import * as crypto from 'crypto';

interface WebhookPayload {
  event: string;
  orgId: string;
  timestamp: string;
  data: Record<string, any>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly maxRetries = 3;
  private readonly retryDelays = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listen for all significant events and dispatch to matching webhooks.
   */
  @OnEvent('**') // Listen to ALL events
  async handleEvent(eventName: string, payload: any) {
    // Only process domain events
    const supportedEvents = [
      'golden_record.created',
      'golden_record.updated',
      'golden_record.deleted',
      'source_record.matched',
      'connector.run.completed',
      'form.submitted',
      'relationship.created',
      'suggestion.created',
      'suggestion.accepted',
    ];

    if (!supportedEvents.includes(eventName)) return;

    const orgId = payload.orgId || payload.organizationId;
    if (!orgId) return;

    // Find active webhooks for this org and event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        eventTypes: { has: eventName },
      },
    });

    if (webhooks.length === 0) return;

    const webhookPayload: WebhookPayload = {
      event: eventName,
      orgId,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    // Dispatch to all matching webhooks concurrently
    for (const webhook of webhooks) {
      this.dispatchWithRetry(webhook.id, webhook.url, webhook.secretHash, webhookPayload);
    }
  }

  /**
   * Dispatch a webhook with retry logic.
   */
  private async dispatchWithRetry(
    webhookId: string,
    url: string,
    secret: string | null,
    payload: WebhookPayload,
    attempt: number = 0,
  ): Promise<void> {
    try {
      const body = JSON.stringify(payload);
      const signature = secret
        ? crypto.createHmac('sha256', secret).update(body).digest('hex')
        : undefined;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-OmniCore-Event': payload.event,
        'X-OmniCore-Delivery': crypto.randomUUID(),
        ...(signature ? { 'X-OmniCore-Signature': signature } : {}),
      };

      const response = await axios.post(url, payload, {
        headers,
        timeout: 10000,
      });

      // Log successful delivery
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventPayload: payload as unknown as any,
          responseStatus: response.status,
          responseBody: JSON.stringify(response.data).substring(0, 1000),
          success: true,
        },
      });

      this.logger.debug(`Webhook ${webhookId} delivered successfully (${response.status})`);
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || 0;
      const retryable = status >= 500 || status === 429 || status === 0;

      if (retryable && attempt < this.maxRetries) {
        const delay = this.retryDelays[attempt] || 15000;
        this.logger.warn(`Webhook ${webhookId} failed (attempt ${attempt + 1}), retrying in ${delay}ms`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.dispatchWithRetry(webhookId, url, secret, payload, attempt + 1);
      }

      // Log failed delivery
      await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          eventPayload: payload as unknown as any,
          responseStatus: status,
          responseBody: axiosError.message?.substring(0, 1000),
          success: false,
        },
      });

      this.logger.error(`Webhook ${webhookId} permanently failed after ${attempt + 1} attempts`);
    }
  }

  /**
   * Test a webhook by sending a ping event.
   */
  async testWebhook(webhookId: string): Promise<{ success: boolean; status?: number; message?: string }> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new Error('Webhook not found');

    const testPayload: WebhookPayload = {
      event: 'ping',
      orgId: webhook.organizationId,
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test from OmniCore Africa' },
    };

    try {
      const response = await axios.post(webhook.url, testPayload, {
        headers: { 'Content-Type': 'application/json', 'X-OmniCore-Event': 'ping' },
        timeout: 5000,
      });

      return { success: true, status: response.status, message: 'Webhook responded successfully' };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        success: false,
        status: axiosError.response?.status || 0,
        message: axiosError.message,
      };
    }
  }
}