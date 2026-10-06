import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  orgId: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  realm_access: { roles: string[] };
  required_actions: string[];
}

export interface RefreshRecord {
  userId: string;
  createdAt: number;
}

/**
 * Issues and validates our own tokens now that Keycloak is gone.
 *
 * - Access tokens are stateless, short-lived JWTs signed with JWT_SECRET.
 * - Refresh tokens are opaque random strings. Only their SHA-256 hash is stored
 *   (in Redis), so a Redis leak does not hand over usable tokens. They rotate on
 *   every use and are deleted on logout, which gives us real revocation — something
 *   the pass-through Keycloak tokens never had.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly refreshTtlMs: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    this.refreshTtlMs = this.parseDuration(
      this.config.get<string>('JWT_REFRESH_TTL', '30d'),
      30 * 24 * 60 * 60 * 1000,
    );
  }

  /** Sign a short-lived access token for a user. */
  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }

  /** Verify an access token. Throws on invalid/expired tokens. */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /** Mint a new refresh token for a user and store its hash. */
  async issueRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const record: RefreshRecord = { userId, createdAt: Date.now() };
    await this.cache.set(this.refreshKey(token), record, this.refreshTtlMs);
    return token;
  }

  /**
   * Exchange a refresh token for a new one, rotating it in the process.
   * Returns the owning user id plus the replacement token, or null if the
   * token is unknown/expired/already rotated.
   */
  async rotateRefreshToken(
    token: string,
  ): Promise<{ userId: string; refreshToken: string } | null> {
    const key = this.refreshKey(token);
    const record = await this.cache.get<RefreshRecord>(key);
    if (!record?.userId) return null;

    // Consume before issuing so a replayed token cannot be used twice.
    await this.cache.del(key);
    const refreshToken = await this.issueRefreshToken(record.userId);
    return { userId: record.userId, refreshToken };
  }

  /** Revoke a single refresh token. Safe to call with an unknown token. */
  async revokeRefreshToken(token: string): Promise<void> {
    await this.cache.del(this.refreshKey(token));
  }

  /** Parse durations like "15m", "30d", "3600" (seconds) into milliseconds. */
  private parseDuration(value: string, fallbackMs: number): number {
    const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(String(value).trim());
    if (!match) return fallbackMs;

    const amount = parseInt(match[1], 10);
    const unitMs: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * (unitMs[match[2] ?? 's'] ?? 1000);
  }

  private refreshKey(token: string): string {
    return `refresh:${crypto.createHash('sha256').update(token).digest('hex')}`;
  }
}
