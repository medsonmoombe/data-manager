import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @RequirePermissions('users:manage')
  async createInvitation(@Req() req: any, @Body() dto: { email: string; teamIds: string[]; role: string }) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    const userId = req.user?.sub;
    return this.invitationService.createInvitation(orgId, userId, dto);
  }

  @Get()
  @RequirePermissions('users:manage')
  async getPendingInvitations(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.invitationService.getPendingInvitations(orgId);
  }

  @Post('accept')
  async acceptInvitation(@Body() dto: { token: string }) {
    return this.invitationService.acceptInvitation(dto.token);
  }

  @Delete(':id')
  @RequirePermissions('users:manage')
  async revokeInvitation(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.invitationService.revokeInvitation(orgId, id);
  }

  @Post(':id/resend')
  @RequirePermissions('users:manage')
  async resendInvitation(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.invitationService.resendInvitation(orgId, id);
  }
}
