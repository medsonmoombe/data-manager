import { Global, Module } from '@nestjs/common';
import { SoftDeleteService } from '../../common/services/soft-delete.service';
import { TrashController } from './trash.controller';
import { PurgeService } from './purge.service';
import { ExportService } from '../../common/services/export.service';

@Global()
@Module({
  controllers: [TrashController],
  providers: [SoftDeleteService, PurgeService, ExportService],
  exports: [SoftDeleteService],
})
export class SystemModule {}