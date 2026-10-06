import { Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { BaseCrudService } from './base-crud.service';

export abstract class BaseCrudController<T, CreateDto, UpdateDto> {
  constructor(protected readonly service: BaseCrudService<T, CreateDto, UpdateDto>) {}

  @Get()
  async findAll(@Req() req: any): Promise<T[]> {
    const orgId = req.user?.orgId; // extracted from JWT
    return this.service.findAll(orgId);
  }

  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string): Promise<T | null> {
    const orgId = req.user?.orgId;
    return this.service.findOne(orgId, id);
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateDto): Promise<T> {
    const orgId = req.user?.orgId;
    return this.service.create(orgId, dto);
  }

  @Put(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateDto): Promise<T> {
    const orgId = req.user?.orgId;
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string): Promise<T> {
    const orgId = req.user?.orgId;
    return this.service.delete(orgId, id);
  }
}