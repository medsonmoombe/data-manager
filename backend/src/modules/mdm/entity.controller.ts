import {
  Controller, Get, Post, Put, Delete, Param, Body, Req,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { EntityService } from './entity.service';
// import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('entities')
export class EntityController {
  constructor(private readonly entityService: EntityService) {}

  /**
   * List all entity definitions for the org.
   */
  @Get()
  // @RequirePermissions('records:read')
  async findAll(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.findAll(orgId);
  }

  /**
   * Get a single entity with its attributes.
   */
  @Get(':id')
  // @RequirePermissions('records:read')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.findOne(orgId, id);
  }

  /**
   * Create a new entity category with attributes.
   */
  @Post()
  // @RequirePermissions('records:create')
  async create(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.create(orgId, dto);
  }

  /**
   * Update an entity definition.
   */
  @Put(':id')
  // @RequirePermissions('records:update')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.update(orgId, id, dto);
  }

  /**
   * Delete an entity (only if no records exist).
   */
  @Delete(':id')
  // @RequirePermissions('records:delete')
  async remove(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.remove(orgId, id);
  }

  // ============ ATTRIBUTES ============

  /**
   * Add an attribute to an entity.
   */
  @Post(':entityId/attributes')
  // @RequirePermissions('records:update')
  async addAttribute(
    @Req() req: any,
    @Param('entityId') entityId: string,
    @Body() dto: any,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.addAttribute(orgId, entityId, dto);
  }

  /**
   * Update an attribute.
   */
  @Put(':entityId/attributes/:attributeId')
  // @RequirePermissions('records:update')
  async updateAttribute(
    @Req() req: any,
    @Param('entityId') entityId: string,
    @Param('attributeId') attributeId: string,
    @Body() dto: any,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.updateAttribute(orgId, entityId, attributeId, dto);
  }

  /**
   * Remove an attribute.
   */
  @Delete(':entityId/attributes/:attributeId')
  // @RequirePermissions('records:update')
  async removeAttribute(
    @Req() req: any,
    @Param('entityId') entityId: string,
    @Param('attributeId') attributeId: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.removeAttribute(orgId, entityId, attributeId);
  }

  /**
   * Bulk update attributes.
   */
  @Put(':entityId/attributes')
  // @RequirePermissions('records:update')
  async updateAttributes(
    @Req() req: any,
    @Param('entityId') entityId: string,
    @Body() dto: any[],
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.entityService.updateAttributes(orgId, entityId, dto);
  }
}