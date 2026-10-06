import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TokenService } from '../../infrastructure/jwt/token.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './services/auth-token.service';
import { MailService } from './services/mail.service';

/**
 * Authentication flows.
 *
 * Self-contained: credentials are validated against the local database and tokens
 * are issued by `TokenService`. There is no Keycloak call and no email OTP step —
 * login returns tokens directly. Emailed one-time tokens are used only for
 * password reset and email verification.
 */
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly tokenService: TokenService,
    private readonly authTokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Step 1: validate credentials and issue tokens immediately.
   */
  async login(identifier: string, password: string) {
    const result = await this.auth.validateCredentials(identifier, password);

    if (!result.ok) {
      switch (result.reason) {
        case 'inactive':
          throw new UnauthorizedException('This account has been deactivated.');
        case 'no-password':
          // Invited users, and users carried over from Keycloak, have no
          // portable password hash. Point them at the reset flow instead of
          // leaving them with a confusing "invalid password".
          throw new UnauthorizedException(
            'This account has no password set yet. Use "Forgot password" to set one.',
          );
        default:
          // Deliberately generic: do not reveal whether the account exists.
          throw new UnauthorizedException('Invalid email or password.');
      }
    }

    const user = result.user;
    await this.auth.recordLogin(user.id);

    const session = await this.auth.buildSession(user.id);
    this.logger.log(`Login succeeded: ${user.email}`);

    return { requires2FA: false, ...session };
  }

  /**
   * Exchange a refresh token for a new access token. The refresh token is rotated.
   */
  async refresh(refreshToken: string) {
    const rotated = await this.tokenService.rotateRefreshToken(refreshToken);
    if (!rotated) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    const session = await this.auth.buildSession(rotated.userId);

    // buildSession mints its own refresh token; discard it in favour of the
    // rotated one so the client keeps a single live token.
    await this.tokenService.revokeRefreshToken(session.refreshToken);

    return { ...session, refreshToken: rotated.refreshToken };
  }

  /** Revoke a refresh token. */
  async logout(refreshToken?: string) {
    if (refreshToken) {
      await this.tokenService.revokeRefreshToken(refreshToken);
    }
    return { success: true, message: 'Signed out successfully.' };
  }

  /**
   * Send a password reset link. Always reports success so the endpoint cannot be
   * used to enumerate accounts.
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const generic = {
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
    };

    const user = await this.auth.getByEmail(email);
    if (!user) return generic;

    const token = await this.authTokens.createResetToken(user.id, user.email);
    await this.mail.sendPasswordResetEmail(user.email, token);

    return generic;
  }

  /** Complete a password reset with a one-time token. */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const record = await this.authTokens.peekResetToken(token);
    if (!record) {
      throw new BadRequestException('Invalid or expired reset link. Please request a new one.');
    }

    // Validate before spending the token, so a rejected password can be retried
    // without requesting a fresh link.
    this.validatePassword(newPassword);

    const consumed = await this.authTokens.consumeResetToken(token);
    if (!consumed) {
      // Lost a race with a concurrent request for the same token.
      throw new BadRequestException('Invalid or expired reset link. Please request a new one.');
    }

    await this.auth.setPassword(record.userId, newPassword);

    return { success: true, message: 'Password reset successfully. You can now sign in.' };
  }

  /**
   * Change the password of an authenticated user.
   * `forceChange` is used for the UPDATE_PASSWORD required action, where the
   * user is not expected to know their current password.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    forceChange = false,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.auth.getById(userId);
    if (!user) throw new BadRequestException('User not found.');

    if (!forceChange) {
      if (!currentPassword) {
        throw new BadRequestException('Current password is required.');
      }
      const valid = await this.auth.verifyPassword(user.passwordHash, currentPassword);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect.');
      }
    }

    this.validatePassword(newPassword);
    await this.auth.setPassword(userId, newPassword);

    return { success: true, message: 'Password changed successfully.' };
  }

  /** Verify an emailed email-verification token. */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const record = await this.authTokens.consumeVerifyToken(token);
    if (!record) {
      throw new BadRequestException('Invalid or expired verification link.');
    }

    await this.auth.setEmailVerified(record.userId, true);
    return { success: true, message: 'Email verified successfully.' };
  }

  /** Send a fresh verification link for the signed-in user. */
  async resendVerification(userId: string) {
    const user = await this.auth.getById(userId);
    if (!user) throw new BadRequestException('User not found.');
    if (user.emailVerified) {
      return { success: true, message: 'Email is already verified.' };
    }

    const token = await this.authTokens.createVerifyToken(user.id, user.email);
    await this.mail.sendVerificationEmail(user.email, token);

    return { success: true, message: 'Verification email sent.' };
  }

  /** Current user profile, including pending required actions. */
  async getMe(userId: string) {
    const user = await this.auth.getById(userId);
    if (!user) throw new BadRequestException('User not found.');

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      emailVerified: user.emailVerified,
      enabled: user.isActive,
      requiredActions: user.requiredActions,
      orgId: user.organizationId,
      orgName: user.organization?.name ?? null,
      lastLogin: user.lastLoginAt,
    };
  }

  /** Clear a required action for the signed-in user. */
  async clearRequiredAction(userId: string, action: string) {
    await this.auth.clearRequiredAction(userId, action);
    return { success: true };
  }

  /** Password strength rules. Mirrors the rules enforced at registration. */
  private validatePassword(password: string) {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Password validation failed', errors });
    }
  }
}
