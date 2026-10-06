import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AuthTokenService } from '../auth/services/auth-token.service';
import { MailService } from '../auth/services/mail.service';
import * as crypto from 'crypto';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Local role given to invited members. Replaces the Keycloak `org_member` realm role. */
const DEFAULT_INVITE_ROLE = 'data_entry';

export interface CreateInvitationData {
  email: string;
  firstName?: string;
  lastName?: string;
  teamIds?: string[];
  /** Role name, e.g. 'data_manager'. */
  role?: string;
  /** Role id, resolved to its name. Takes precedence over `role`. */
  roleId?: string;
}

/**
 * Invitations. This is the single implementation — the duplicate that used to live
 * in `modules/auth/invitation.service.ts` is gone.
 *
 * An invited user is created locally with no password and an UPDATE_PASSWORD
 * required action. The invitation email links to the accept page, which returns a
 * one-time token the user redeems on the reset-password page to set a password.
 */
@Injectable()
export class InvitationService {
  private readonly logger = new Logger(InvitationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly authTokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  async createInvitation(
    orgId: string,
    invitedBy: string,
    data: CreateInvitationData,
  ) {
    const email = data.email.trim().toLowerCase();

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true },
    });
    if (!org) throw new BadRequestException('Organization not found');

    // Resolve the inviter to a real user id (FK target for Invitation.invitedBy).
    const inviter = await this.prisma.user.findUnique({
      where: { id: invitedBy },
      select: { id: true },
    });
    if (!inviter) throw new BadRequestException('Inviting user not found');

    const existingUser = await this.prisma.user.findFirst({
      where: { organizationId: orgId, email },
    });
    if (existingUser) {
      throw new BadRequestException('This user is already a member of your organization');
    }

    const existingInvite = await this.prisma.invitation.findFirst({
      where: { organizationId: orgId, email, status: 'pending', expiresAt: { gt: new Date() } },
    });
    if (existingInvite) {
      throw new BadRequestException('An invitation has already been sent to this email');
    }

    const roleName = await this.resolveRoleName(orgId, data);

    // Create the local account up front. No password: the accept flow sets it.
    await this.auth.createUser({
      organizationId: orgId,
      email,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
      requiredActions: ['UPDATE_PASSWORD'],
      roleNames: [roleName],
      emailVerified: false,
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        email,
        teamIds: data.teamIds ?? [],
        role: roleName,
        invitedBy: inviter.id,
        token,
        status: 'pending',
        expiresAt,
      },
    });

    const acceptUrl = `${this.frontendUrl}/accept-invitation?token=${token}`;
    const mailResult = await this.mail.sendInvitationEmail(email, {
      orgName: org.name,
      acceptUrl,
    });

    this.eventEmitter.emit('invitation.created', {
      invitationId: invitation.id,
      email,
      token,
    });

    this.logger.log(`Invitation sent to ${email} for organization ${org.name}`);

    return {
      success: true,
      message: `Invitation sent to ${email}. They have 7 days to accept.`,
      invitationId: invitation.id,
      expiresAt,
      emailSent: mailResult.success,
    };
  }

  /** Pending, unexpired invitations. */
  async getPendingInvitations(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId: orgId, status: 'pending', expiresAt: { gt: new Date() } },
      include: {
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Every invitation ever sent for the organization. */
  async listInvitations(orgId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Accept an invitation and return a one-time token the user redeems to set
   * their password (no password exists until they do).
   */
  async acceptInvitation(token: string) {
    const invitation = await this.prisma.invitation.findUnique({ where: { token } });
    return this.completeAcceptance(invitation);
  }

  /** Legacy accept variant keyed by email + organization slug. */
  async acceptInvitationByEmail(email: string, orgSlug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });
    if (!org) throw new BadRequestException('Organization not found');

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        organizationId: org.id,
        status: 'pending',
        expiresAt: { gte: new Date() },
      },
    });

    return this.completeAcceptance(invitation);
  }

  async revokeInvitation(orgId: string, invitationId: string) {
    return this.markInvitation(orgId, invitationId, 'revoked');
  }

  async cancelInvitation(orgId: string, invitationId: string) {
    return this.markInvitation(orgId, invitationId, 'cancelled');
  }

  /** Re-issue the token and resend the invitation email. */
  async resendInvitation(orgId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { token, expiresAt, status: 'pending' },
    });

    const acceptUrl = `${this.frontendUrl}/accept-invitation?token=${token}`;
    await this.mail.sendInvitationEmail(invitation.email, {
      orgName: org?.name ?? 'your organization',
      acceptUrl,
    });

    this.eventEmitter.emit('invitation.resend', { email: invitation.email, token });

    return { success: true, message: `Invitation resent to ${invitation.email}.` };
  }

  // ---------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------

  private async completeAcceptance(
    invitation: {
      id: string;
      organizationId: string;
      email: string;
      teamIds: string[];
      role: string;
      invitedBy: string;
      status: string;
      expiresAt: Date;
    } | null,
  ) {
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'pending') {
      throw new BadRequestException('This invitation has already been processed');
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: invitation.email, organizationId: invitation.organizationId },
    });
    if (!user) throw new BadRequestException('Invited account not found');

    // Add the user to any teams the invitation specified.
    for (const teamId of invitation.teamIds) {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId, userId: user.id } },
        update: { role: invitation.role },
        create: {
          teamId,
          userId: user.id,
          role: invitation.role,
          invitedBy: invitation.invitedBy ?? user.id,
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    // The account has no password yet — hand back a one-time token so the
    // client can take the user straight to "set your password".
    const setPasswordToken = await this.authTokens.createResetToken(user.id, user.email);

    this.eventEmitter.emit('invitation.accepted', {
      userId: user.id,
      orgId: invitation.organizationId,
      invitationId: invitation.id,
    });

    return { success: true, setPasswordToken };
  }

  private async markInvitation(orgId: string, invitationId: string, status: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    await this.prisma.invitation.update({ where: { id: invitationId }, data: { status } });

    return { success: true, message: `Invitation ${status}` };
  }

  private async resolveRoleName(orgId: string, data: CreateInvitationData): Promise<string> {
    if (data.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: data.roleId, organizationId: orgId },
        select: { name: true },
      });
      if (!role) throw new BadRequestException('Role not found in this organization');
      return role.name;
    }

    if (data.role) {
      const role = await this.prisma.role.findFirst({
        where: { organizationId: orgId, name: data.role },
        select: { name: true },
      });
      return role?.name ?? DEFAULT_INVITE_ROLE;
    }

    return DEFAULT_INVITE_ROLE;
  }
}
