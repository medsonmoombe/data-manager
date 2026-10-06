import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { WorkflowEngineService } from './workflow-engine.service';

@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  // =====================
  // Definitions CRUD
  // =====================

  @Get('definitions')
  async listDefinitions(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.workflowDefinition.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { instances: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Post('definitions')
  async createDefinition(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.workflowDefinition.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig || {},
        steps: dto.steps || [],
      },
    });
  }

  @Get('definitions/:id')
  async getDefinition(@Param('id') id: string) {
    const def = await this.prisma.workflowDefinition.findUnique({
      where: { id },
      include: { instances: { take: 10, orderBy: { startedAt: 'desc' } } },
    });
    if (!def) throw new NotFoundException('Workflow definition not found');
    return def;
  }

  @Put('definitions/:id')
  async updateDefinition(@Param('id') id: string, @Body() dto: any) {
    return this.prisma.workflowDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        triggerConfig: dto.triggerConfig,
        steps: dto.steps,
        isActive: dto.isActive,
        version: { increment: 1 },
      },
    } as any);
  }

  @Delete('definitions/:id')
  async deleteDefinition(@Param('id') id: string) {
    return this.prisma.workflowDefinition.delete({ where: { id } });
  }

  // =====================
  // Instances
  // =====================

  @Get('instances')
  async listInstances(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('definitionId') definitionId?: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (definitionId) where.definitionId = definitionId;

    return this.prisma.workflowInstance.findMany({
      where,
      include: { definition: { select: { name: true } }, tasks: { select: { id: true, taskName: true, status: true } } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  @Post('definitions/:id/start')
  async startWorkflowManually(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const instanceId = await this.workflowEngine.startWorkflowManually(id, orgId, dto.variables || {});
    return { success: true, instanceId };
  }

  @Post('instances/:id/cancel')
  async cancelInstance(@Param('id') id: string) {
    await this.prisma.workflowInstance.update({
      where: { id },
      data: { status: 'cancelled', completedAt: new Date() },
    });
    return { success: true };
  }

  // =====================
  // Tasks
  // =====================

  @Get('tasks')
  async listTasks(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('assigneeRole') assigneeRole?: string,
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (assigneeId) where.assigneeId = assigneeId;
    if (assigneeRole) where.assigneeRole = assigneeRole;

    return this.prisma.workflowTask.findMany({
      where,
      include: { instance: { select: { id: true, definition: { select: { name: true } }, triggerData: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get('tasks/my')
  async getMyTasks(@Req() req: any) {
    const userId = req.user?.sub;
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    const include = {
      instance: {
        select: {
          id: true,
          organizationId: true,
          definition: { select: { name: true } },
          triggerData: true,
          variables: true,
          startedAt: true,
        },
      },
    };

    // `userId` is the local User.id (tokens are issued by us).
    const dbUser = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          include: { userRoles: { include: { role: { select: { name: true } } } } },
        })
      : null;

    const userRoleNames: string[] = dbUser?.userRoles.map((ur) => ur.role.name) ?? [];

    const orConditions: any[] = [
      ...(dbUser ? [{ assigneeId: dbUser.id }] : []),
      { assigneeId: null, assigneeRole: null }, // unassigned — visible to all
      ...(userRoleNames.length > 0 ? [{ assigneeRole: { in: userRoleNames } }] : []),
    ];

    let tasks = await this.prisma.workflowTask.findMany({
      where: { status: 'pending', OR: orConditions },
      include,
      orderBy: { createdAt: 'desc' },
    });

    // Fallback: if still nothing, return all pending tasks for this org
    // (covers dev/relaxed-auth mode and org admins who should see everything)
    if (tasks.length === 0 && orgId) {
      tasks = await this.prisma.workflowTask.findMany({
        where: { status: 'pending', instance: { organizationId: orgId } },
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    return { data: tasks, total: tasks.length };
  }

  @Post('tasks/bulk-approve')
  async bulkApproveTasks(@Req() req: any, @Body() dto: { taskIds: string[]; comment?: string }) {
    const userId = req.user?.sub;
    const results = { approved: 0, failed: 0, errors: [] as string[] };

    for (const taskId of dto.taskIds) {
      try {
        const task = await this.prisma.workflowTask.findUnique({
          where: { id: taskId },
          include: { instance: { include: { definition: true } } },
        });
        if (!task || task.status !== 'pending') {
          results.failed++;
          results.errors.push(`Task ${taskId.slice(0, 8)}... not found or not pending`);
          continue;
        }

        await this.workflowEngine.completeTask(taskId, userId, 'approve', dto.comment);

        const triggerData = (task.instance.triggerData || {}) as any;
        const recordId = triggerData.recordId;
        if (recordId) {
          const record = await this.prisma.goldenRecord.findUnique({
            where: { id: recordId },
            select: { data: true },
          });
          if (record) {
            const steps = (task.instance.definition.steps as any[]) || [];
            const currentStep = steps.find((s: any) => s.id === task.stepId);
            const hasNextStep = currentStep?.nextStep && steps.some((s: any) => s.id === currentStep.nextStep);

            await this.prisma.goldenRecord.update({
              where: { id: recordId },
              data: {
                data: {
                  ...(record.data as any),
                  _workflowStatus: hasNextStep ? 'in_review' : 'approved',
                  _approvedBy: userId,
                  _approvedAt: new Date().toISOString(),
                },
              },
            });
          }
        }
        results.approved++;
      } catch {
        results.failed++;
        results.errors.push(`Task ${taskId.slice(0, 8)}... failed`);
      }
    }

    return results;
  }

  @Post('tasks/:id/approve')
  async approveTask(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const userId = req.user?.sub;
    const task = await this.prisma.workflowTask.findUnique({
      where: { id },
      include: { instance: { include: { definition: true } } },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'pending') throw new BadRequestException('Task is not pending');

    await this.workflowEngine.completeTask(id, userId, 'approve', dto.comment);

    const triggerData = (task.instance.triggerData || {}) as any;
    const recordId = triggerData.recordId;
    if (recordId) {
      const record = await this.prisma.goldenRecord.findUnique({
        where: { id: recordId },
        select: { data: true },
      });
      if (record) {
        // Determine if all steps after this one are done (workflow completed)
        const steps = (task.instance.definition.steps as any[]) || [];
        const currentStep = steps.find((s: any) => s.id === task.stepId);
        const hasNextStep = currentStep?.nextStep && steps.some((s: any) => s.id === currentStep.nextStep);

        await this.prisma.goldenRecord.update({
          where: { id: recordId },
          data: {
            data: {
              ...(record.data as any),
              _workflowStatus: hasNextStep ? 'in_review' : 'approved',
              _approvedBy: userId,
              _approvedAt: new Date().toISOString(),
            },
          },
        });
      }
    }
    return { success: true, action: 'approve' };
  }

  @Post('tasks/:id/reject')
  async rejectTask(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const userId = req.user?.sub;
    const task = await this.prisma.workflowTask.findUnique({
      where: { id },
      include: { instance: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.status !== 'pending') throw new BadRequestException('Task is not pending');

    await this.workflowEngine.completeTask(id, userId, 'reject', dto.comment);

    const triggerData = (task.instance.triggerData || {}) as any;
    const recordId = triggerData.recordId;
    if (recordId) {
      const record = await this.prisma.goldenRecord.findUnique({
        where: { id: recordId },
        select: { data: true },
      });
      if (record) {
        await this.prisma.goldenRecord.update({
          where: { id: recordId },
          data: {
            data: {
              ...(record.data as any),
              _workflowStatus: 'rejected',
              _rejectedBy: userId,
              _rejectedAt: new Date().toISOString(),
              _rejectReason: dto.comment || '',
            },
          },
        });
      }
    }
    return { success: true, action: 'reject' };
  }
}