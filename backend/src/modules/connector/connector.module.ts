import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConnectorController } from './connector.controller';
import { ConnectorService } from './connector.service';
import { ConnectorCrudService } from './services/connector-crud.service';
import { ConnectorExecutionProcessor } from './connector-execution.processor';
import { CsvAdapter } from './adapters/csv.adapter';
import { RestApiAdapter } from './adapters/rest-api.adapter';
import { AdapterRegistry } from './adapters/adapter-registry';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'connector-execution' }),
    SchedulerModule,
  ],
  controllers: [ConnectorController],
  providers: [
    ConnectorService,
    ConnectorCrudService,
    ConnectorExecutionProcessor,
    CsvAdapter,
    RestApiAdapter,
    AdapterRegistry,
  ],
  exports: [ConnectorService, ConnectorExecutionProcessor],
})
export class ConnectorModule {}
