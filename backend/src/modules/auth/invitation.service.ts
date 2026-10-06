import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak.admin.service';
import * as crypto from 'crypto';

@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
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

  async inviteMember(
    orgId: string,
    invitedBy: string,
    dto: { email: string; firstName: string; lastName: string; roleId: string },
    frontendUrl: string,
  ) {
    const existingUser = await this.prisma.user.findFirst({
      where: { organizationId: orgId, email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException('This user is already a member of your organization');
    }

    const existingInvite = await this.prisma.invitation.findFirst({
      where: { organizationId: orgId, email: dto.email, status: 'pending', expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      throw new BadRequestException('An invitation has already been sent to this email');
    }

    const tempPassword = this.config.get<string>('DEFAULT_USER_PASSWORD') || this.generatePassword();
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true },
    });
    if (!org) throw new BadRequestException('Organization not found');

    try {
      const keycloakUser = await this.keycloakAdmin.createUser({
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        password: tempPassword,
        orgId: orgId,
        orgName: org.name,
        requiredActions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
        realmRoles: ['org_member'],
        emailVerified: false,
      });

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const token = crypto.randomBytes(32).toString('hex');

      const invitation = await this.prisma.invitation.create({
        data: {
          organizationId: orgId,
          email: dto.email,
          teamIds: [],
          role: 'member',
          invitedBy,
          token,
          status: 'pending',
          expiresAt,
        },
      });

      const redirectUri = `${frontendUrl}/accept-invitation?org=${org.slug}&email=${encodeURIComponent(dto.email)}`;

      if (keycloakUser) {
        await this.keycloakAdmin.sendInvitationEmail(
          keycloakUser.id!,
          'frontend',
          redirectUri,
          604800,
        );
      }

      this.logger.log(`Invitation sent to ${dto.email} for organization ${org.name}`);

      return {
        success: true,
        message: `Invitation sent to ${dto.email}. They have 7 days to accept.`,
        invitationId: invitation.id,
        expiresAt,
      };
    } catch (error) {
      this.logger.error('Failed to invite member:', error);
      throw new BadRequestException('Failed to send invitation. Please try again.');
    }
  }

  async acceptInvitation(email: string, orgId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { email, organizationId: orgId, status: 'pending', expiresAt: { gte: new Date() } },
    });

    if (!invitation) throw new BadRequestException('Invitation not found or has expired');

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    const keycloakUser = await this.prisma.user.findFirst({
      where: { email, organizationId: orgId },
    });

    if (!keycloakUser) {
      const kcUser = await this.keycloakAdmin.getUserByEmail(email);
      await this.prisma.user.create({
        data: {
          organizationId: orgId,
          keycloakUserId: kcUser?.id || '',
          username: email,
          email,
          firstName: '',
          lastName: '',
          isActive: true,
        },
      });
    }

    return { success: true, message: 'Invitation accepted' };
  }

  async listInvitations(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelInvitation(orgId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) throw new BadRequestException('Invitation not found');

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'cancelled' },
    });

    return { success: true, message: 'Invitation cancelled' };
  }
}
