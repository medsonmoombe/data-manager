import { Module } from '@nestjs/common';
import { MdmController } from './mdm.controller';
import { EntityController } from './entity.controller';
import { MatchingRulesController } from './matching-rules.controller';
import { EntityService } from './entity.service';
import { MatchingEngineService } from './services/matching-engine.service';
import { MdmPipelineService } from './services/mdm-pipeline.service';

@Module({
  controllers: [MdmController, EntityController, MatchingRulesController],
  providers: [EntityService, MatchingEngineService, MdmPipelineService],
  exports: [EntityService, MatchingEngineService, MdmPipelineService],
})
export class MdmModule {}