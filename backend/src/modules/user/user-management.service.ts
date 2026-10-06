import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { DEFAULT_ROLES } from './default-roles';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign the default role to a new user.
   */
  private async assignDefaultRole(userId: string, orgId: string) {
    const defaultRole = await this.prisma.role.findFirst({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });

    if (defaultRole) {
      const exists = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId: defaultRole.id } },
      });
      if (!exists) {
        await this.prisma.userRole.create({
          data: { userId, roleId: defaultRole.id },
        });
      }
    }
  }

  /**
   * Seed default roles for an organization.
   */
  async seedDefaultRoles(orgId: string) {
    for (const [key, roleDef] of Object.entries(DEFAULT_ROLES)) {
      const existing = await this.prisma.role.findFirst({
        where: { organizationId: orgId, name: key },
      });

      if (!existing) {
        await this.prisma.role.create({
          data: {
            organizationId: orgId,
            name: key,
            description: roleDef.description,
            isSystemRole: roleDef.isSystemRole || false,
            permissions: roleDef.permissions,
          },
        });
        this.logger.log(`Created role: ${key} for org ${orgId}`);
      }
    }
  }

  /**
   * Assign a role to a user.
   */
  async assignRole(userId: string, roleId: string, orgId: string) {
    // Verify role belongs to org
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, organizationId: orgId },
    });

    if (!role) throw new Error('Role not found');

    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });

    if (existing) return existing;

    return this.prisma.userRole.create({
      data: { userId, roleId },
    });
  }

  /**
   * Remove a role from a user.
   */
  async removeRole(userId: string, roleId: string) {
    return this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });
  }

  /**
   * Get all users in an organization.
   */
  async getUsers(orgId: string) {
    return this.prisma.user.findMany({
      where: { organizationId: orgId },
      include: {
        userRoles: {
          include: { role: { select: { id: true, name: true, description: true } } },
        },
        userAttributes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all roles in an organization.
   */
  async getRoles(orgId: string) {
    return this.prisma.role.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { userRoles: true } } },
    });
  }

  /**
   * Create a custom role.
   */
  async createRole(orgId: string, dto: { name: string; description?: string; permissions: string[] }) {
    return this.prisma.role.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
      },
    });
  }

  /**
   * Update a role's permissions.
   */
  async updateRole(roleId: string, dto: { name?: string; description?: string; permissions?: string[] }) {
    return this.prisma.role.update({
      where: { id: roleId },
      data: dto,
    });
  }

  /**
   * Delete a custom role (not system roles).
   */
  async deleteRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (role?.isSystemRole) throw new Error('Cannot delete system roles');
    return this.prisma.role.delete({ where: { id: roleId } });
  }

  /**
   * Update user profile.
   */
  async updateUser(userId: string, dto: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        jobTitle: dto.jobTitle,
        departmentId: dto.departmentId,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Deactivate a user (soft).
   */
  async deactivateUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }

  async activateUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
  }
}