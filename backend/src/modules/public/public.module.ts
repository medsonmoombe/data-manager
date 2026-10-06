import { Module } from '@nestjs/common';
import { CitizenController } from './citizen.controller';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { OrganizationsController } from './organizations.controller';
import { OtpService } from './otp.service';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  controllers: [CitizenController, WhatsAppWebhookController, OrganizationsController],
  providers: [OtpService, WhatsAppBotService, EncryptionService],
  exports: [OtpService, WhatsAppBotService],
})
export class PublicModule {}