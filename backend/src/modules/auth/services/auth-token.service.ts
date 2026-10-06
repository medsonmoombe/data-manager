import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';

interface TokenRecord {
  userId: string;
  email: string;
  createdAt: number;
}

/**
 * One-time, short-lived tokens for password reset and email verification.
 *
 * These used to live on `EmailOtpService` keyed by Keycloak user id; they are now
 * keyed by the local `User.id`. Backed by Redis via cache-manager.
 */
@Injectable()
export class AuthTokenService {
  private readonly logger = new Logger(AuthTokenService.name);
  private readonly RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async createResetToken(userId: string, email: string): Promise<string> {
    return this.create('reset', userId, email, this.RESET_TTL_MS);
  }

  /**
   * Read a reset token without consuming it.
   *
   * Used to validate the new password BEFORE spending the token, so a user who
   * types a weak password can correct it without requesting another email.
   */
  async peekResetToken(token: string): Promise<TokenRecord | null> {
    return this.peek('reset', token);
  }

  /** Consume a reset token (single use). Returns null if unknown or expired. */
  async consumeResetToken(token: string): Promise<TokenRecord | null> {
    return this.consume('reset', token);
  }

  async createVerifyToken(userId: string, email: string): Promise<string> {
    return this.create('verify', userId, email, this.VERIFY_TTL_MS);
  }

  async consumeVerifyToken(token: string): Promise<TokenRecord | null> {
    return this.consume('verify', token);
  }

  private async create(
    prefix: string,
    userId: string,
    email: string,
    ttlMs: number,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const record: TokenRecord = { userId, email, createdAt: Date.now() };
    try {
      await this.cache.set(`${prefix}:${token}`, record, ttlMs);
    } catch (e) {
      this.logger.warn(`Cache set failed (${prefix}): ${e}`);
    }
    return token;
  }

  private async peek(prefix: string, token: string): Promise<TokenRecord | null> {
    if (!token) return null;
    try {
      const record = await this.cache.get<TokenRecord>(`${prefix}:${token}`);
      return record?.userId ? record : null;
    } catch { return null; }
  }

  private async consume(prefix: string, token: string): Promise<TokenRecord | null> {
    if (!token) return null;
    const key = `${prefix}:${token}`;
    try {
      const record = await this.cache.get<TokenRecord>(key);
      if (!record?.userId) return null;
      await this.cache.del(key);
      return record;
    } catch { return null; }
  }
}
