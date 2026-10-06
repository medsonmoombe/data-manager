import { Injectable } from '@nestjs/common';
import { INotificationProvider, NotificationPayload, NotificationResult } from './base-provider';

@Injectable()
export class InAppProvider implements INotificationProvider {
  readonly providerName = 'in_app';
  readonly channel = 'in_app';

  async send(payload: NotificationPayload, config: Record<string, any>): Promise<NotificationResult> {
    // In-app notifications are stored directly in the notifications table
    // No external provider needed — the status is set to 'delivered' immediately
    return {
      success: true,
      providerMessageId: `in_app_${Date.now()}`,
    };
  }

  async getDeliveryStatus(providerMessageId: string, config: Record<string, any>): Promise<string> {
    return 'delivered';
  }
}