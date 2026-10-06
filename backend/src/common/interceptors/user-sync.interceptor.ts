import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, from, lastValueFrom } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UserManagementService } from '../../modules/user/user-management.service';

@Injectable()
export class UserSyncInterceptor implements NestInterceptor {
  constructor(
    private readonly userService: UserManagementService,
    private readonly prisma: PrismaService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (user && user.sub) {
      let orgId = request.headers['x-org-id'] || user.orgId;

      // If no orgId from header or token, try first active org
      if (!orgId) {
        const firstOrg = await this.prisma.organization.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (firstOrg) {
          orgId = firstOrg.id;
        }
      }

      // Only sync if we have a valid orgId
      if (orgId) {
        const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
        if (org) {
          await this.userService.syncUserFromKeycloak(user, orgId);
          await this.userService.seedDefaultRoles(orgId);
        }
      }
    }

    return next.handle();
  }
}