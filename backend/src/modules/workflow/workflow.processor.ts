import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { WorkflowEngineService } from './workflow-engine.service';

function InjectWorkflowEngine() {
  return Inject(forwardRef(() => WorkflowEngineService));
}

@Processor('workflow-wait')
export class WorkflowWaitProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowWaitProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectWorkflowEngine() private readonly engine: WorkflowEngineService,
  ) {
    super();
  }

  async process(job: Job<{ instanceId: string; stepId: string; taskId: string }>): Promise<any> {
    const { instanceId, stepId, taskId } = job.data;

    this.logger.log(`Wait completed for step ${stepId} in instance ${instanceId}`);

    // Mark wait task as completed
    await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Resume workflow
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: { definition: true },
    });

    if (instance && instance.status === 'running') {
      const steps = instance.definition.steps as any[];
      const currentStep = steps.find((s: any) => s.id === stepId);

      if (currentStep) {
        // Find and execute next step
        const nextStepId = currentStep.nextStep;
        const nextStep = steps.find((s: any) => s.id === nextStepId);

        if (nextStep) {
          // Access private method via any cast (we'll refactor to public later)
          await (this.engine as any).completeStep(instanceId, currentStep, steps, Date.now());
        } else {
          await (this.engine as any).completeWorkflow(instanceId);
        }
      }
    }

    return { success: true };
  }
}

@Processor('workflow-escalation')
export class WorkflowEscalationProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowEscalationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ taskId: string; escalationConfig: any; instanceId: string }>): Promise<any> {
    const { taskId, escalationConfig } = job.data;

    const task = await this.prisma.workflowTask.findUnique({ where: { id: taskId } });
    if (!task || task.status !== 'pending') return { skipped: true };

    this.logger.log(`Escalating task ${taskId}: ${escalationConfig.action}`);

    switch (escalationConfig.action) {
      case 'reassign':
        await this.prisma.workflowTask.update({
          where: { id: taskId },
          data: {
            assigneeId: null,
            assigneeRole: escalationConfig.escalateToRole || 'admin',
            assignedAt: new Date(),
            priority: { increment: 1 },
          },
        });
        break;

      case 'auto_reject':
        await this.prisma.workflowTask.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            completedAt: new Date(),
            result: { action: 'auto_rejected', reason: 'deadline_exceeded' },
          },
        });
        break;

      case 'auto_approve':
        await this.prisma.workflowTask.update({
          where: { id: taskId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            result: { action: 'auto_approved', reason: 'deadline_exceeded' },
          },
        });
        break;
    }

    return { success: true };
  }
}

@Processor('workflow-parallel')
export class WorkflowParallelProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowParallelProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectWorkflowEngine() private readonly engine: WorkflowEngineService,
  ) {
    super();
  }

  async process(job: Job<{ instanceId: string; branchId: string; stepId: string }>): Promise<any> {
    const { instanceId, branchId } = job.data;
    this.logger.log(`Parallel branch ${branchId} completed for instance ${instanceId}`);
    return { success: true, branchId };
  }
}
