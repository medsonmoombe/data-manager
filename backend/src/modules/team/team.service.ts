import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * `user.sub` is already the local User.id, so this only has to confirm the
   * user exists. (It used to translate a Keycloak id into a local one.)
   */
  private async resolveUserId(userId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user?.id;
  }

  async findAll(orgId: string, userId?: string) {
    const internalUserId = userId ? await this.resolveUserId(userId) : undefined;
    const teams = await this.prisma.team.findMany({
      where: { organizationId: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
            },
          },
        },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return teams.map(team => ({
      id: team.id,
      name: team.name,
      description: team.description,
      avatarUrl: team.avatarUrl,
      memberCount: team._count.members,
      members: team.members.map(m => ({
        id: m.user.id,
        name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim(),
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      createdAt: team.createdAt,
      isMember: internalUserId ? team.members.some(m => m.userId === internalUserId) : false,
    }));
  }

  async findOne(orgId: string, teamId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, jobTitle: true },
            },
          },
        },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!team) throw new NotFoundException('Team not found');

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      avatarUrl: team.avatarUrl,
      createdBy: team.createdByUser,
      members: team.members.map(m => ({
        id: m.user.id,
        name: `${m.user.firstName || ''} ${m.user.lastName || ''}`.trim(),
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        jobTitle: m.user.jobTitle,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async create(orgId: string, userId: string, data: { name: string; description?: string }) {
    const internalUserId = await this.resolveUserId(userId);
    if (!internalUserId) {
      throw new NotFoundException('User not found');
    }

    const team = await this.prisma.team.create({
      data: { organizationId: orgId, name: data.name, description: data.description, createdBy: internalUserId },
    });

    await this.prisma.teamMember.create({
      data: { teamId: team.id, userId: internalUserId, role: 'owner', invitedBy: internalUserId },
    });

    this.eventEmitter.emit('team.created', { orgId, teamId: team.id, userId: internalUserId });
    return team;
  }

  async update(orgId: string, teamId: string, data: { name?: string; description?: string; avatarUrl?: string }) {
    const team = await this.prisma.team.update({
      where: { id: teamId },
      data: { name: data.name, description: data.description, avatarUrl: data.avatarUrl },
    });
    this.eventEmitter.emit('team.updated', { orgId, teamId });
    return team;
  }

  async delete(orgId: string, teamId: string) {
    await this.prisma.team.delete({ where: { id: teamId } });
    this.eventEmitter.emit('team.deleted', { orgId, teamId });
  }

  async addMembers(orgId: string, teamId: string, userIds: string[], role: string, invitedBy: string) {
    const results = [];
    for (const userId of userIds) {
      const existing = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      if (!existing) {
        const member = await this.prisma.teamMember.create({
          data: { teamId, userId, role, invitedBy },
        });
        results.push(member);
        this.eventEmitter.emit('team.member.added', { orgId, teamId, userId });
      }
    }
    return results;
  }

  async removeMember(orgId: string, teamId: string, userId: string) {
    const member = await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });
    this.eventEmitter.emit('team.member.removed', { orgId, teamId, userId });
    return member;
  }

  async updateMemberRole(orgId: string, teamId: string, userId: string, role: string) {
    const member = await this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
    });
    this.eventEmitter.emit('team.member.role.updated', { orgId, teamId, userId, role });
    return member;
  }

  async getUserTeams(orgId: string, userId: string) {
    const internalUserId = await this.resolveUserId(userId);
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: internalUserId },
      include: { team: true },
    });
    return memberships.map(m => m.team);
  }
}
