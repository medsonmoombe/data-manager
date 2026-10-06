import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConnectorService } from './connector.service';

@Processor('connector-execution')
export class ConnectorExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ConnectorExecutionProcessor.name);

  constructor(private readonly connectorService: ConnectorService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { jobId, triggeredBy } = job.data;

    this.logger.log(`Processing job ${jobId} (triggered by: ${triggeredBy})`);

    try {
      const runId = await this.connectorService.executeJob(jobId, job.data.triggeredByUser);
      this.logger.log(`Job ${jobId} completed successfully (run: ${runId})`);
      return { success: true, runId };
    } catch (error) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      throw error;
    }
  }
}
