import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak.admin.service';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly config: ConfigService,
  ) {}

  private generatePassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;
    const required = [
      upper[crypto.randomInt(upper.length)],
      lower[crypto.randomInt(lower.length)],
      digits[crypto.randomInt(digits.length)],
      special[crypto.randomInt(special.length)],
    ];
    for (let i = required.length; i < 12; i++) {
      required.push(all[crypto.randomInt(all.length)]);
    }
    for (let i = required.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [required[i], required[j]] = [required[j], required[i]];
    }
    return required.join('');
  }

  async createInvitation(orgId: string, keycloakUserId: string, data: { email: string; teamIds: string[]; role: string }) {
    const inviter = await this.prisma.user.findUnique({ where: { keycloakUserId } });
    const invitedBy = inviter?.id || keycloakUserId;

    const existingUser = await this.prisma.user.findFirst({
      where: { email: data.email, organizationId: orgId },
    });

    if (existingUser) {
      for (const teamId of data.teamIds) {
        await this.prisma.teamMember.upsert({
          where: { teamId_userId: { teamId, userId: existingUser.id } },
          update: { role: data.role },
          create: { teamId, userId: existingUser.id, role: data.role, invitedBy },
        });
      }
      return { success: true, existingUser: true };
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true },
    });

    let keycloakUser = await this.keycloakAdmin.getUserByEmail(data.email);

    if (!keycloakUser) {
      const tempPassword = this.config.get<string>('DEFAULT_USER_PASSWORD') || this.generatePassword();
      keycloakUser = await this.keycloakAdmin.createUser({
        email: data.email,
        firstName: '',
        lastName: '',
        password: tempPassword,
        orgId,
        orgName: org?.name,
        requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
        realmRoles: ['org_member'],
        emailVerified: false,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email: data.email,
        teamIds: data.teamIds,
        role: data.role,
        invitedBy,
        token,
        expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const redirectUri = `${frontendUrl}/accept-invitation?org=${org?.slug || orgId}&email=${encodeURIComponent(data.email)}`;

    if (keycloakUser) {
      await this.keycloakAdmin.sendInvitationEmail(
        keycloakUser.id!,
        'frontend',
        redirectUri,
        604800,
      );
    }

    this.eventEmitter.emit('invitation.created', {
      invitationId: invitation.id,
      email: data.email,
      token,
    });

    return { success: true, invitationId: invitation.id };
  }

  async acceptInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending') throw new BadRequestException('Invitation already processed');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation expired');

    const user = await this.prisma.user.findFirst({
      where: { email: invitation.email, organizationId: invitation.organizationId },
    });
    if (!user) throw new BadRequestException('Please complete registration first');

    for (const teamId of invitation.teamIds) {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: user.id } },
        update: { role: invitation.role },
        create: { teamId, userId: user.id, role: invitation.role, invitedBy: invitation.invitedBy },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    this.eventEmitter.emit('invitation.accepted', { userId: user.id, orgId: invitation.organizationId, invitationId: invitation.id });
    return { success: true };
  }

  async getPendingInvitations(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId: orgId, status: 'pending', expiresAt: { gt: new Date() } },
      include: {
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvitation(orgId: string, invitationId: string) {
    return this.prisma.invitation.update({
      where: { id: invitationId, organizationId: orgId },
      data: { status: 'revoked' },
    });
  }

  async resendInvitation(orgId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { token, expiresAt, status: 'pending' },
    });

    const keycloakUser = await this.keycloakAdmin.getUserByEmail(invitation.email);

    if (keycloakUser) {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { slug: true },
      });
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
      const redirectUri = `${frontendUrl}/accept-invitation?org=${org?.slug || orgId}&email=${encodeURIComponent(invitation.email)}`;

      await this.keycloakAdmin.sendInvitationEmail(
        keycloakUser.id!,
        'frontend',
        redirectUri,
        604800,
      );
    }

    this.eventEmitter.emit('invitation.resend', {
      email: invitation.email,
      token,
    });

    return { success: true };
  }
}
