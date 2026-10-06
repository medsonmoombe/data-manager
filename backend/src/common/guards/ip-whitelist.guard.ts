import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { Reflector } from '@nestjs/core';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipWhitelist = this.reflector.get<boolean>('skipWhitelist', context.getHandler());
    if (skipWhitelist) return true;

    const request = context.switchToHttp().getRequest();
    const clientIp = this.getClientIp(request);
    const orgId = request.user?.orgId || request.headers['x-org-id'];

    if (!orgId) return true;

    const whitelistEntries = await this.prisma.ipWhitelist.findMany({
      where: { organizationId: orgId, isActive: true },
    });

    if (whitelistEntries.length === 0) return true;

    const isAllowed = whitelistEntries.some(entry => 
      clientIp === entry.ipAddress || 
      this.isIpInCidr(clientIp, entry.cidr || `${entry.ipAddress}/32`)
    );

    if (!isAllowed) {
      throw new ForbiddenException(`Access denied: IP ${clientIp} not whitelisted`);
    }

    return true;
  }

  private getClientIp(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.connection?.remoteAddress || '0.0.0.0';
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    try {
      const [network, prefix] = cidr.split('/');
      const prefixLen = parseInt(prefix, 10);
      
      const ipNum = this.ipToNumber(ip);
      const networkNum = this.ipToNumber(network);
      const mask = ~((1 << (32 - prefixLen)) - 1);
      
      return (ipNum & mask) === (networkNum & mask);
    } catch {
      return false;
    }
  }

  private ipToNumber(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }
}