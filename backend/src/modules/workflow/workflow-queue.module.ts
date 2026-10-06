import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkflowWaitProcessor, WorkflowEscalationProcessor, WorkflowParallelProcessor } from './workflow.processor';
import { WorkflowModule } from './workflow.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'workflow-wait' },
      { name: 'workflow-escalation' },
      { name: 'workflow-parallel' },
    ),
    forwardRef(() => WorkflowModule),
  ],
  providers: [WorkflowWaitProcessor, WorkflowEscalationProcessor, WorkflowParallelProcessor],
  exports: [BullModule],
})
export class WorkflowQueueModule {}