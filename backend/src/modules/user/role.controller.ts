import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('roles')
export class RoleController {
  constructor(private readonly userService: UserManagementService) {}

  @Get()
  @RequirePermissions('users:manage')
  async getRoles(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.userService.getRoles(orgId);
  }

  @Post()
  @RequirePermissions('users:manage')
  async createRole(@Req() req: any, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.userService.createRole(orgId, dto);
  }

  @Put(':id')
  @RequirePermissions('users:manage')
  async updateRole(@Param('id') id: string, @Body() dto: any) {
    return this.userService.updateRole(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:manage')
  async deleteRole(@Param('id') id: string) {
    return this.userService.deleteRole(id);
  }

  @Get('permissions/list')
  async getAvailablePermissions() {
    return {
      permissions: [
        { resource: 'records', actions: ['read', 'create', 'update', 'delete'] },
        { resource: 'forms', actions: ['read', 'submit', 'manage'] },
        { resource: 'workflows', actions: ['view', 'approve', 'manage'] },
        { resource: 'dashboards', actions: ['view', 'create', 'manage'] },
        { resource: 'reports', actions: ['view', 'create', 'export'] },
        { resource: 'users', actions: ['manage'] },
        { resource: 'exports', actions: ['create'] },
        { resource: 'templates', actions: ['install', 'manage'] },
        { resource: 'connectors', actions: ['view', 'create', 'manage', 'run'] },
        { resource: 'settings', actions: ['manage'] },
        { resource: 'notifications', actions: ['view', 'manage'] },
        { resource: 'webhooks', actions: ['view', 'create', 'manage'] },
      ],
    };
  }
}