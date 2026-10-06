import { Module } from '@nestjs/common';
import { ActivityController } from './activity.controller';
import { SubscriptionController } from './subscription.controller';
import { ActivityLoggerService } from './activity-logger.service';

@Module({
  controllers: [ActivityController, SubscriptionController],
  providers: [ActivityLoggerService],
  exports: [ActivityLoggerService],
})
export class ActivityModule {}