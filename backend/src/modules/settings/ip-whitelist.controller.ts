import { Controller, Get, Post, Put, Delete, Body, Param, Req } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { NotFoundException } from '@nestjs/common';

@Controller('settings/ip-whitelist')
export class IpWhitelistController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('settings:manage')
  async list(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.prisma.ipWhitelist.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @RequirePermissions('settings:manage')
  async create(@Req() req: any, @Body() dto: { ipAddress: string; cidr?: string; description?: string }) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    
    return this.prisma.ipWhitelist.create({
      data: {
        organizationId: orgId,
        ipAddress: dto.ipAddress,
        cidr: dto.cidr,
        description: dto.description,
        createdBy: userId,
      },
    });
  }

  @Delete(':id')
  @RequirePermissions('settings:manage')
  async delete(@Param('id') id: string) {
    const entry = await this.prisma.ipWhitelist.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('IP whitelist entry not found');
    return this.prisma.ipWhitelist.delete({ where: { id } });
  }

  @Put(':id/toggle')
  @RequirePermissions('settings:manage')
  async toggle(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    const entry = await this.prisma.ipWhitelist.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('IP whitelist entry not found');
    return this.prisma.ipWhitelist.update({
      where: { id },
      data: { isActive },
    });
  }
}