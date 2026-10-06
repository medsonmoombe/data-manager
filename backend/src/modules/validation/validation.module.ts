import { Module } from '@nestjs/common';
import { ValidationController } from './validation.controller';
import { ValidationEngineService } from './validation-engine.service';

@Module({
  controllers: [ValidationController],
  providers: [ValidationEngineService],
  exports: [ValidationEngineService],
})
export class ValidationModule {}