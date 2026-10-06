import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { SavedSearchController } from './saved-search.controller';
import { WidgetDataService } from './widget-data.service';

@Module({
  controllers: [DashboardController, SavedSearchController],
  providers: [WidgetDataService],
  exports: [WidgetDataService],
})
export class DashboardModule {}