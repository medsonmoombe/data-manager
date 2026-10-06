import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.requestId = uuidv4();

    const orgId = request.user?.orgId || request.headers['x-org-id'];
    const userId = request.user?.sub;

    if (orgId && userId) {
      request.auditContext = {
        orgId,
        userId,
        ipAddress: request.ip,
        userAgent: request.get?.('user-agent'),
      };
    }

    return next.handle();
  }
}
