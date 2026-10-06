import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { JwtAuthGuard } from '../../infrastructure/jwt/jwt-auth.guard';
import * as crypto from 'crypto';

/**
 * Accepts either a user Bearer token or an `x-api-key`.
 *
 * The Keycloak delegation is gone: user requests now go through our own
 * `JwtAuthGuard`. The API-key path is unchanged.
 */
@Injectable()
export class CompositeAuthGuard implements CanActivate {
  private readonly logger = new Logger(CompositeAuthGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtAuthGuard: JwtAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (apiKey) {
      return this.authenticateWithApiKey(request, String(apiKey));
    }

    return this.jwtAuthGuard.canActivate(context);
  }

  private async authenticateWithApiKey(request: any, apiKey: string): Promise<boolean> {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const key = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (!key) {
      this.logger.warn('Invalid or expired API key');
      return false;
    }

    if (key.maxRequests && key.requestCount >= key.maxRequests) {
      this.logger.warn(`API key ${key.name} exceeded request limit: ${key.requestCount}/${key.maxRequests}`);
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { isActive: false },
      }).catch(() => {});
      return false;
    }

    if (key.expiresAt && new Date() > key.expiresAt) {
      this.logger.warn(`API key ${key.name} expired on ${key.expiresAt}`);
      await this.prisma.apiKey.update({
        where: { id: key.id },
        data: { isActive: false },
      }).catch(() => {});
      return false;
    }

    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: {
        requestCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    }).catch(() => {});

    request.user = {
      sub: `api_key_${key.id}`,
      orgId: key.organizationId,
      scopes: key.scopes,
      permissions: key.scopes || [],
      isApiKey: true,
      preferred_username: `api:${key.name}`,
      realm_access: { roles: [] },
    };

    request.headers['x-org-id'] = key.organizationId;

    this.logger.log(`API key ${key.name}: ${key.requestCount + 1}/${key.maxRequests || '∞'} requests`);
    return true;
  }
}
