import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UserManagementService } from './user-management.service';
import { TeamService } from '../team/team.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserManagementService,
    private readonly prisma: PrismaService,
    private readonly teamService: TeamService,
  ) {}

  @Get()
  @RequirePermissions('users:manage')
  async getUsers(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.userService.getUsers(orgId);
  }

  @Get('me')
  async getCurrentUser(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: { select: { id: true, name: true, description: true, permissions: true } } },
        },
        userAttributes: true,
        teams: { include: { team: true } },
      },
    });
  }

  @Get('me/teams')
  async getMyTeams(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.teamService.getUserTeams(orgId, userId);
  }

  @Get(':id')
  @RequirePermissions('users:manage')
  async getUser(@Param('id') id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: { role: { select: { id: true, name: true, description: true, permissions: true } } },
        },
        userAttributes: true,
        teams: { include: { team: true } },
      },
    });
  }

  @Put(':id')
  @RequirePermissions('users:manage')
  async updateUser(@Param('id') id: string, @Body() dto: any) {
    return this.userService.updateUser(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermissions('users:manage')
  async deactivateUser(@Param('id') id: string) {
    return this.userService.deactivateUser(id);
  }

  @Post(':id/activate')
  @RequirePermissions('users:manage')
  async activateUser(@Param('id') id: string) {
    return this.userService.activateUser(id);
  }

  @Get(':id/activity')
  @RequirePermissions('users:manage')
  async getUserActivity(@Req() req: any, @Param('id') id: string, @Query('limit') limit = 50) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.userActivity.findMany({
      where: { organizationId: orgId, userId: id },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
    });
  }

  @Post(':id/roles/:roleId')
  @RequirePermissions('users:manage')
  async assignRole(
    @Req() req: any,
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.userService.assignRole(userId, roleId, orgId);
  }

  @Delete(':id/roles/:roleId')
  @RequirePermissions('users:manage')
  async removeRole(@Param('id') userId: string, @Param('roleId') roleId: string) {
    return this.userService.removeRole(userId, roleId);
  }

  @Get(':id/permissions')
  @RequirePermissions('users:manage')
  async getUserPermissions(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) throw new Error('User not found');

    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      const rolePerms = ur.role.permissions as string[];
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }

    return {
      userId: user.id,
      username: user.username,
      permissions: Array.from(permissions),
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }
}