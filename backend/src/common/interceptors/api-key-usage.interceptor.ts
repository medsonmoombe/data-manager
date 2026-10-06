import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class ApiKeyUsageInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    if (!user?.isApiKey) return next.handle();

    const apiKeyId = user.sub?.replace('api_key_', '');
    const endpoint = request.url || request.originalUrl || '';
    const method = request.method;
    const ipAddress = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    const userAgent = request.headers['user-agent'] || '';

    return next.handle().pipe(
      tap({
        next: async () => {
          const responseTimeMs = Date.now() - startTime;
          const statusCode = context.switchToHttp().getResponse().statusCode;

          this.prisma.apiKeyUsageLog.create({
            data: { apiKeyId, organizationId: user.orgId, endpoint, method, statusCode, ipAddress, userAgent, responseTimeMs },
          }).catch(() => {});
        },
        error: async () => {
          const responseTimeMs = Date.now() - startTime;
          const statusCode = context.switchToHttp().getResponse().statusCode || 500;

          this.prisma.apiKeyUsageLog.create({
            data: { apiKeyId, organizationId: user.orgId, endpoint, method, statusCode, ipAddress, userAgent, responseTimeMs },
          }).catch(() => {});
        },
      }),
    );
  }
}
