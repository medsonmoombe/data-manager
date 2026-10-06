import { Controller, Post, Get, Param, Body, Query, Req } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Advanced search with complex conditions.
   */
  @Post('advanced')
  async advancedSearch(@Req() req: any, @Body() query: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.searchService.searchGoldenRecords(orgId, query);
  }

  /**
   * Global quick search.
   */
  @Get('global')
  async globalSearch(
    @Req() req: any,
    @Query('q') q: string,
    @Query('entity') entity?: string,
  ) {
    if (!q) return { results: [], query: '' };
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.searchService.globalSearch(orgId, q, entity);
  }

  /**
   * Auto-complete suggestions.
   */
  @Get('suggestions/:entityName/:field')
  async getSuggestions(
    @Req() req: any,
    @Param('entityName') entityName: string,
    @Param('field') field: string,
    @Query('prefix') prefix: string = '',
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.searchService.getSuggestions(orgId, entityName, field, prefix);
  }
}