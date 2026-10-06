import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { TeamService } from './team.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  @RequirePermissions('users:manage')
  async findAll(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.teamService.findAll(orgId, userId);
  }

  @Post()
  @RequirePermissions('users:manage')
  async create(@Req() req: any, @Body() dto: { name: string; description?: string }) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.teamService.create(orgId, userId, dto);
  }

  @Get(':id')
  @RequirePermissions('users:manage')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.teamService.findOne(orgId, id);
  }

  @Put(':id')
  @RequirePermissions('users:manage')
  async update(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.teamService.update(orgId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:manage')
  async delete(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.teamService.delete(orgId, id);
  }

  @Post(':id/members')
  @RequirePermissions('users:manage')
  async addMembers(@Req() req: any, @Param('id') id: string, @Body() dto: { userIds: string[]; role: string }) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.teamService.addMembers(orgId, id, dto.userIds, dto.role, userId);
  }

  @Delete(':id/members/:userId')
  @RequirePermissions('users:manage')
  async removeMember(@Req() req: any, @Param('id') id: string, @Param('userId') userId: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.teamService.removeMember(orgId, id, userId);
  }

  @Put(':id/members/:userId/role')
  @RequirePermissions('users:manage')
  async updateMemberRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.teamService.updateMemberRole(orgId, id, userId, role);
  }
}
