import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, NotificationPayload, NotificationResult } from './base-provider';
import * as TwilioSDK from 'twilio';
const Twilio = (TwilioSDK as any).default ?? TwilioSDK;

@Injectable()
export class SmsTwilioProvider implements INotificationProvider {
  readonly providerName = 'twilio';
  readonly channel = 'sms';
  private readonly logger = new Logger(SmsTwilioProvider.name);

  async send(payload: NotificationPayload, config: Record<string, any>): Promise<NotificationResult> {
    try {
      const client = Twilio(config.accountSid, config.authToken);

      const message = await client.messages.create({
        body: payload.body.substring(0, 1600),
        from: config.fromNumber,
        to: payload.to,
        statusCallback: config.statusCallbackUrl,
      });

      this.logger.log(`SMS sent to ${payload.to}: ${message.sid}`);

      return {
        success: true,
        providerMessageId: message.sid,
      };
    } catch (err : unknown) {
      this.logger.error(`SMS failed: ${(err as Error).message}`);
      return { success: false, error: (err as Error).message };
    }
  }

  async getDeliveryStatus(providerMessageId: string, config: Record<string, any>): Promise<string> {
    try {
      const client = Twilio(config.accountSid, config.authToken);
      const message = await client.messages(providerMessageId).fetch();
      return message.status; // 'queued','sent','delivered','failed'
    } catch {
      return 'unknown';
    }
  }
}