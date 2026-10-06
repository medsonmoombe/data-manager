import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { Public } from 'nest-keycloak-connect';
import { TenantService } from './tenant.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';
import { BaseCrudController } from '../../common/base/base-crud.controller';
import { Organization } from '@prisma/client';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('tenants')
export class TenantController extends BaseCrudController<Organization, CreateTenantDto, UpdateTenantDto> {
  constructor(private readonly tenantService: TenantService) {
    super(tenantService);
  }

  @Public()
  @Post()
  async create(@Req() req: any, @Body() dto: CreateTenantDto): Promise<Organization> {
    const orgId = req.headers['x-org-id'] || null;
    return this.tenantService.create(orgId, dto);
  }

  @Get()
  @RequirePermissions('settings:manage')
  async findAll(@Req() req: any): Promise<Organization[]> {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.tenantService.findAll(orgId);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.tenantService.findBySlug(slug);
  }
}