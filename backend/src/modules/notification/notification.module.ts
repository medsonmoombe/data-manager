import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { ProviderRegistry } from './adapters/provider-registry';
import { EmailSmtpProvider } from './adapters/email-smtp.provider';
import { SmsTwilioProvider } from './adapters/sms-twilio.provider';
import { WhatsAppBaileysProvider } from './adapters/whatsapp-baileys.provider';
import { InAppProvider } from './adapters/in-app.provider';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notification-dispatch' }),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    ProviderRegistry,
    EmailSmtpProvider,
    SmsTwilioProvider,
    WhatsAppBaileysProvider,
    InAppProvider,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}