import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, NotificationPayload, NotificationResult } from './base-provider';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailSmtpProvider implements INotificationProvider {
  readonly providerName = 'smtp';
  readonly channel = 'email';
  private readonly logger = new Logger(EmailSmtpProvider.name);

  async send(payload: NotificationPayload, config: Record<string, any>): Promise<NotificationResult> {
    try {
      const transporter = nodemailer.createTransport({
        host: config.host || 'smtp.gmail.com',
        port: config.port || 587,
        secure: config.secure || false,
        auth: {
          user: config.username,
          pass: config.password,
        },
      });

      const info = await transporter.sendMail({
        from: config.from || config.username,
        to: payload.to,
        subject: payload.subject || 'Notification from OmniCore',
        html: payload.body,
      });

      this.logger.log(`Email sent to ${payload.to}: ${info.messageId}`);

      return {
        success: true,
        providerMessageId: info.messageId,
      };
    } catch (err: unknown) {
      this.logger.error(`Email failed: ${(err as Error).message}`);
      return { success: false, error: (err as Error).message };
    }
  }

  async getDeliveryStatus(providerMessageId: string, config: Record<string, any>): Promise<string> {
    return 'sent'; // SMTP doesn't provide delivery tracking
  }
}