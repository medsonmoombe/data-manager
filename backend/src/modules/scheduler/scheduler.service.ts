import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('connector-execution') private connectorQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.initializeNextRunTimes();
  }

  private async initializeNextRunTimes() {
    const jobs = await this.prisma.connectorJob.findMany({
      where: { isActive: true, schedule: { not: null }, nextRunAt: null },
      include: { connector: true },
    });

    for (const job of jobs) {
      await this.updateNextRunTime(job.id, job.schedule!);
    }

    if (jobs.length > 0) {
      this.logger.log(`Initialized next_run_at for ${jobs.length} jobs`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueJobs() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const now = new Date();
      const dueJobs = await this.prisma.connectorJob.findMany({
        where: { isActive: true, schedule: { not: null }, nextRunAt: { lte: now } },
        include: { connector: { include: { organization: true } } },
        take: 50,
      });

      if (dueJobs.length === 0) return;

      this.logger.log(`Found ${dueJobs.length} due jobs`);

      for (const job of dueJobs) {
        await this.connectorQueue.add(
          'execute-connector',
          {
            jobId: job.id,
            connectorId: job.connectorId,
            organizationId: job.connector.organizationId,
            triggeredBy: 'scheduler',
            scheduledTime: new Date(),
          },
          {
            jobId: `scheduled-${job.id}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 500,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
        await this.updateNextRunTime(job.id, job.schedule!);
      }

      this.eventEmitter.emit('scheduler.batch.completed', { count: dueJobs.length, timestamp: new Date() });
    } catch (error) {
      this.logger.error(`Scheduler error: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async triggerJobNow(jobId: string, triggeredBy: string): Promise<{ success: boolean; message: string }> {
    const job = await this.prisma.connectorJob.findUnique({
      where: { id: jobId },
      include: { connector: true },
    });

    if (!job) throw new Error(`Job ${jobId} not found`);

    await this.connectorQueue.add(
      'execute-connector',
      {
        jobId: job.id,
        connectorId: job.connectorId,
        organizationId: job.connector.organizationId,
        triggeredBy: 'manual',
        triggeredByUser: triggeredBy,
        scheduledTime: new Date(),
      },
      { jobId: `manual-${job.id}-${Date.now()}`, priority: 1 },
    );

    this.logger.log(`Manual trigger for job ${jobId} by ${triggeredBy}`);
    return { success: true, message: 'Job queued for execution' };
  }

  async getUpcomingRuns(orgId: string, limit = 20) {
    const jobs = await this.prisma.connectorJob.findMany({
      where: {
        connector: { organizationId: orgId },
        isActive: true,
        schedule: { not: null },
        nextRunAt: { not: null },
      },
      include: { connector: { select: { name: true, connectorType: true } } },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });

    return jobs.map(job => ({
      id: job.id,
      name: job.name,
      connectorName: job.connector.name,
      connectorType: job.connector.connectorType,
      schedule: job.schedule,
      nextRunAt: job.nextRunAt,
      targetEntity: job.targetEntity,
    }));
  }

  async pauseJob(jobId: string) {
    await this.prisma.connectorJob.update({
      where: { id: jobId },
      data: { isActive: false, nextRunAt: null },
    });
    return { success: true, message: 'Job paused' };
  }

  async resumeJob(jobId: string) {
    const job = await this.prisma.connectorJob.findUnique({ where: { id: jobId } });
    if (!job || !job.schedule) throw new Error('Job has no schedule defined');

    await this.updateNextRunTime(jobId, job.schedule);
    await this.prisma.connectorJob.update({
      where: { id: jobId },
      data: { isActive: true },
    });
    return { success: true, message: 'Job resumed' };
  }

  async updateSchedule(jobId: string, enabled: boolean, cronExpression?: string) {
    const data: any = { isActive: enabled };

    if (cronExpression) {
      data.schedule = cronExpression;
      await this.updateNextRunTime(jobId, cronExpression);
    }

    if (!enabled) {
      data.nextRunAt = null;
    }

    await this.prisma.connectorJob.update({ where: { id: jobId }, data });
    return { success: true, message: enabled ? 'Job scheduled' : 'Job disabled' };
  }

  private async updateNextRunTime(jobId: string, cronExpression: string) {
    try {
      const interval = CronExpressionParser.parse(cronExpression, { currentDate: new Date() });
      const nextRun = interval.next().toDate();
      await this.prisma.connectorJob.update({
        where: { id: jobId },
        data: { nextRunAt: nextRun },
      });
    } catch (error) {
      this.logger.error(`Invalid cron expression for job ${jobId}: ${cronExpression}`);
      await this.prisma.connectorJob.update({
        where: { id: jobId },
        data: { isActive: false, nextRunAt: null },
      });
    }
  }
}
