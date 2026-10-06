import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

interface IdempotentResponse {
  statusCode: number;
  body: any;
  storedAt: Date;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours

  // In-memory cache (use Redis in production)
  private cache = new Map<string, IdempotentResponse>();

  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    // Skip GET, HEAD, OPTIONS (they're naturally idempotent)
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return next.handle();
    }

    // Get idempotency key from header
    const idempotencyKey = request.headers['x-idempotency-key'];
    if (!idempotencyKey) {
      return next.handle(); // No key = no idempotency guarantee
    }

    // Check if we've already processed this key
    const cached = await this.getCachedResponse(idempotencyKey);
    if (cached) {
      // Return the previously stored response
      const response = context.switchToHttp().getResponse();
      response.status(cached.statusCode);
      return of(cached.body);
    }

    // First time: process and cache the response
    return next.handle().pipe(
      tap(async (body) => {
        const response = context.switchToHttp().getResponse();
        await this.cacheResponse(idempotencyKey, {
          statusCode: response.statusCode,
          body,
          storedAt: new Date(),
        });
      }),
    );
  }

  private async getCachedResponse(key: string): Promise<IdempotentResponse | null> {
    // Check in-memory cache first
    const cached = this.cache.get(key);
    if (cached) {
      if (Date.now() - cached.storedAt.getTime() < this.ttlMs) {
        return cached;
      }
      this.cache.delete(key);
    }

    // Check database (survives server restart)
    const stored = await this.prisma.idempotencyRecord.findUnique({
      where: { key },
    });

    if (stored && Date.now() - stored.createdAt.getTime() < this.ttlMs) {
      return {
        statusCode: stored.statusCode,
        body: stored.responseBody,
        storedAt: stored.createdAt,
      };
    }

    return null;
  }

  private async cacheResponse(key: string, response: IdempotentResponse): Promise<void> {
    // In-memory cache
    this.cache.set(key, response);

    // Database persistence (survives server restart)
    await this.prisma.idempotencyRecord.upsert({
      where: { key },
      create: {
        key,
        statusCode: response.statusCode,
        responseBody: response.body,
      },
      update: {
        statusCode: response.statusCode,
        responseBody: response.body,
      },
    });

    // Cleanup old records
    setTimeout(() => {
      this.cache.delete(key);
    }, this.ttlMs);
  }
}