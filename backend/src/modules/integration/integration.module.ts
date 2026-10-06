import { Module } from '@nestjs/common';
import { ApiKeyController } from './api-key.controller';
import { WebhookController } from './webhook.controller';
import { ApiKeyUsageService } from './api-key-usage.service';

@Module({
  controllers: [ApiKeyController, WebhookController],
  providers: [ApiKeyUsageService],
  exports: [ApiKeyUsageService],
})
export class IntegrationModule {}
