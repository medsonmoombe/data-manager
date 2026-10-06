import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class OrgInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.sub) {
      // Try to get orgId from header first
      let orgId = request.headers['x-org-id'];

      // If no header, get default organization
      if (!orgId) {
        const defaultOrg = await this.prisma.organization.findFirst({
          where: { isActive: true, slug: 'default' },
          select: { id: true , name: true},
        });
         // Get organization name
  if (defaultOrg) {
    user.orgName = defaultOrg.name;
  }
        orgId = defaultOrg?.id;
      }

      // Set orgId on user object and request
      if (orgId) {
        user.orgId = orgId;
        request.headers['x-org-id'] = orgId;
      }

      // Sync user to database
      await this.syncUser(user, orgId);
    }

    return next.handle();
  }

  private async syncUser(keycloakUser: any, orgId: string | undefined) {
    if (!orgId) return;

    try {
      const existing = await this.prisma.user.findUnique({
        where: { keycloakUserId: keycloakUser.sub },
      });

      if (existing) {
        await this.prisma.user.update({
          where: { id: existing.id },
          data: { lastLoginAt: new Date() },
        });
        return;
      }

      // Create user with valid orgId
      await this.prisma.user.create({
        data: {
          organizationId: orgId,
          keycloakUserId: keycloakUser.sub,
          username: keycloakUser.preferred_username || keycloakUser.email || keycloakUser.sub,
          email: keycloakUser.email || '',
          firstName: keycloakUser.given_name || '',
          lastName: keycloakUser.family_name || '',
          isActive: true,
          lastLoginAt: new Date(),
        },
      });

      console.log(`✅ User synced: ${keycloakUser.preferred_username || keycloakUser.email}`);
    } catch (error) {
      console.error('User sync failed:');
    }
  }
}