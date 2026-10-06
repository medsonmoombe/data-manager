import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Processor('notification-dispatch')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  async process(job: Job<{ notificationId: string }>): Promise<any> {
    const { notificationId } = job.data;
    this.logger.debug(`Dispatching notification: ${notificationId}`);
    await this.notificationService.dispatchNotification(notificationId);
    return { success: true };
  }
}