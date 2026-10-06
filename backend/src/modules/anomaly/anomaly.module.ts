import { Module } from '@nestjs/common';
import { AnomalyController } from './anomaly.controller';
import { AnomalyDetectorService } from './anomaly-detector.service';

@Module({
  controllers: [AnomalyController],
  providers: [AnomalyDetectorService],
  exports: [AnomalyDetectorService],
})
export class AnomalyModule {}