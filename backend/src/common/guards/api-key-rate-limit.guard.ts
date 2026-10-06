import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus, Logger } from '@nestjs/common';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyRateLimitGuard.name);
  private readonly store = new Map<string, RateLimitEntry>();
  private readonly defaultLimit = 100;
  private readonly defaultWindowMs = 60 * 1000;

  constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.isApiKey) return true;

    const keyId = user.sub;
    const now = Date.now();

    let entry = this.store.get(keyId);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + this.defaultWindowMs };
      this.store.set(keyId, entry);
    }

    entry.count++;

    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', this.defaultLimit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, this.defaultLimit - entry.count));
    response.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > this.defaultLimit) {
      this.logger.warn(`API key ${keyId} rate limited: ${entry.count}/${this.defaultLimit}`);
      throw new HttpException(
        {
          statusCode: 429,
          message: 'Too many requests. Please slow down.',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt + 60 * 1000) {
        this.store.delete(key);
      }
    }
  }
}
