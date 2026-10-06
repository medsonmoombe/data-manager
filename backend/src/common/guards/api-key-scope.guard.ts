import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyScopeGuard.name);

  private readonly blockedPrefixes = [
    '/api-keys',
    '/users',
    '/roles',
    '/settings',
    '/audit',
    '/system',
    '/connectors',
    '/marketplace/templates',
  ];

  private readonly allowedPrefixes = [
    '/mdm/records',
    '/entities',
    '/forms',
    '/webhooks',
    '/export',
    '/dashboards/my',
    '/dashboards/widgets',
    '/intelligence/profile',
    '/intelligence/relationships',
    '/intelligence/timeline',
    '/intelligence/lineage',
    '/search',
    '/validation/results',
    '/activity',
  ];

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.isApiKey) return true;

    // Strip query params, then strip any global prefix (/api/v1, /api, etc.)
    // so the path always starts with the route segment e.g. /mdm/records/...
    const rawPath: string = (request.url || request.originalUrl || '').split('?')[0];
    const path = rawPath.replace(/^\/api(\/v\d+)?/, '');
    const method = request.method;

    this.logger.debug(`API key requesting: ${method} ${path} (raw: ${rawPath})`);

    for (const prefix of this.blockedPrefixes) {
      if (path.startsWith(prefix)) {
        this.logger.warn(`API key blocked from ${method} ${path}`);
        throw new ForbiddenException('API keys cannot access this endpoint. Full user authentication required.');
      }
    }

    const isAllowed = this.allowedPrefixes.some(prefix => path.startsWith(prefix));

    if (!isAllowed) {
      this.logger.warn(`API key attempted unknown endpoint: ${method} ${path}`);
      throw new ForbiddenException('API keys can only access data endpoints (records, forms, entities, webhooks, exports).');
    }

    return true;
  }
}
