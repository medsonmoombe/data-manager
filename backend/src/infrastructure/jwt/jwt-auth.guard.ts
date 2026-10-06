import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService, AccessTokenPayload } from './token.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Validates our own Bearer JWTs and populates `req.user`.
 *
 * Drop-in replacement for the `AuthGuard` that came from `nest-keycloak-connect`:
 * it honours the same `@Public()` metadata and produces the same `req.user` shape
 * the rest of the codebase already reads (`sub`, `orgId`, `realm_access`, …).
 *
 * `sub` is the local `User.id` (not a Keycloak id). Roles and required actions are
 * read fresh from the database on each request rather than trusted from the token,
 * so permission and role changes take effect immediately.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.tokenService.verifyAccessToken(token);
    } catch {
      // A public route should still work if the caller sends a stale token.
      if (isPublic) return true;
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        organization: { select: { id: true, name: true } },
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });

    if (!user) {
      if (isPublic) return true;
      throw new UnauthorizedException('User no longer exists');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    request.user = {
      sub: user.id,
      email: user.email,
      given_name: user.firstName ?? '',
      family_name: user.lastName ?? '',
      preferred_username: user.username ?? user.email,
      orgId: user.organizationId,
      orgName: user.organization?.name ?? null,
      realm_access: { roles: user.userRoles.map((ur) => ur.role.name) },
      required_actions: user.requiredActions,
    };

    // Controllers and guards fall back to this header when `user.orgId` is absent.
    request.headers['x-org-id'] = user.organizationId;

    return true;
  }

  private extractBearerToken(request: any): string | null {
    const header = request.headers?.authorization ?? request.headers?.Authorization;
    if (typeof header !== 'string') return null;
    const [scheme, value] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;
    return value.trim();
  }
}
