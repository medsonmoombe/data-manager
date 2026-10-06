import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class ApiKeyMaskingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.headers['x-api-key']) {
      const key = request.headers['x-api-key'];
      if (typeof key === 'string' && key.length > 15) {
        request.headers['x-api-key'] = key.substring(0, 11) + '...' + key.substring(key.length - 4);
      }
    }

    return next.handle();
  }
}
