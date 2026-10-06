import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export const PERMISSIONS_KEY = 'requiredPermissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No permissions required = public endpoint
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('Authentication required');
    }

    // Get user's permissions
    const userPermissions = await this.getUserPermissions(user.sub, request);

    // Check all required permissions
    const hasAccess = requiredPermissions.every((required) =>
      this.matchPermission(required, userPermissions),
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }

  private async getUserPermissions(userId: string, request?: any): Promise<string[]> {
    if (request?.user?.isApiKey) {
      return request.user.permissions || [];
    }

    // `user.sub` is the local User.id now that tokens are issued by us.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!user || !user.isActive) return [];

    const permissions: string[] = [];
    for (const userRole of user.userRoles) {
      const rolePerms = userRole.role.permissions as string[];
      permissions.push(...rolePerms);
    }

    return [...new Set(permissions)];
  }

  private matchPermission(required: string, userPermissions: string[]): boolean {
    if (userPermissions.includes('*:*')) return true;
    if (userPermissions.includes(required)) return true;

    const [resource, action] = required.split(':');
    for (const perm of userPermissions) {
      const [permResource, permAction] = perm.split(':');
      if (permResource === resource && permAction === '*') return true;
      if (permResource === '*' && permAction === action) return true;
    }

    return false;
  }
}