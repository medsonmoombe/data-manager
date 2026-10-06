import { Module } from '@nestjs/common';
import { WorkflowController } from './workflow.controller';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowQueueModule } from './workflow-queue.module';
import { WorkflowWaitProcessor, WorkflowEscalationProcessor } from './workflow.processor';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [WorkflowQueueModule, NotificationModule],
  controllers: [WorkflowController],
  providers: [WorkflowEngineService, WorkflowWaitProcessor, WorkflowEscalationProcessor],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}