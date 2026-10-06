import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * This interceptor doesn't modify queries directly (Prisma handles that via middleware).
 * It ensures soft-deleted records are never returned in API responses.
 * 
 * The actual filtering happens in Prisma middleware (see below).
 */
@Injectable()
export class SoftDeleteInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If response has data array, filter out any with deletedAt
        if (data?.data && Array.isArray(data.data)) {
          data.data = data.data.filter((item: any) => !item.deletedAt);
          data.total = data.data.length;
        }
        return data;
      }),
    );
  }
}