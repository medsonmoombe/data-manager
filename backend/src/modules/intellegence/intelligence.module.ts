import { Module } from '@nestjs/common';
import { IntelligenceController } from './intelligence.controller';
import { ProfileBuilderService } from './services/profile-builder.service';
import { TimelineService } from './services/timeline.service';
import { RelationshipService } from './services/relationship.service';
import { AutoLinkService } from './services/auto-link.service';
import { DuplicateDetectorService } from './services/duplicate-detector.service';
import { LineageService } from './services/lineage.service';
import { NarrativeReportService } from './services/narrative-report.service';
import { SearchService } from './services/search.service';

@Module({
  controllers: [IntelligenceController],
  providers: [ProfileBuilderService, TimelineService, RelationshipService, AutoLinkService,
  DuplicateDetectorService,
  LineageService,
  NarrativeReportService,
  SearchService,
  ],
  exports: [ProfileBuilderService, TimelineService, RelationshipService, SearchService],
})
export class IntelligenceModule {}