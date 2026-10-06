import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SoftDeleteService } from '../../common/services/soft-delete.service';

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(private readonly softDelete: SoftDeleteService) {}

  /**
   * Run daily at 3:00 AM to purge expired trash.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredTrash() {
    this.logger.log('Starting trash purge...');

    const models = ['goldenRecord', 'formSubmission', 'formDefinition'];
    let totalPurged = 0;

    for (const model of models) {
      const count = await this.softDelete.purgeExpired(model, 30); // 30-day retention
      totalPurged += count;
      if (count > 0) {
        this.logger.log(`Purged ${count} ${model} records`);
      }
    }

    this.logger.log(`Trash purge complete. Total purged: ${totalPurged}`);
  }
}