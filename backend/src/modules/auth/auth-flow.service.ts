import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak.admin.service';
import { EmailOtpService } from './services/email-otp.service';

/**
 * Auth Flow Service
 *
 * Handles the custom authentication flow that bypasses Keycloak's built-in UI:
 * - Login with optional 2FA
 * - Two-factor authentication via email OTP
 * - Password reset (forgot/reset)
 * - Password change (authenticated)
 * - User info with required actions
 */
@Injectable()
export class AuthFlowService {
  private readonly logger = new Logger(AuthFlowService.name);

  constructor(
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly emailOtp: EmailOtpService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Step 1: Validate credentials and initiate login.
   * If 2FA is enabled, sends OTP and returns a session ID.
   * If no 2FA, returns tokens directly.
   */
  async login(
    username: string,
    password: string,
  ): Promise<
    | { requires2FA: true; sessionId: string; email: string }
    | { requires2FA: false; accessToken: string; refreshToken: string; user: any }
  > {
    // Validate credentials against Keycloak
    const tokens = await this.keycloakAdmin.validateCredentials(username, password);
    if (!tokens) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    // Parse the access token to get user info
    const payload = this.parseJwt(tokens.accessToken);
    if (!payload) {
      throw new UnauthorizedException('Failed to process authentication token.');
    }

    const email = payload.email || username;
    const keycloakUserId = payload.sub;

    // Check if user has 2FA enabled (stored as Keycloak user attribute)
    const otpEnabled = await this.keycloakAdmin.getUserAttribute(keycloakUserId, 'otpEnabled');

    if (otpEnabled === 'true') {
      // Store pending login in Redis (tokens held temporarily)
      const sessionId = await this.emailOtp.storePendingLogin(
        email,
        keycloakUserId,
        tokens.accessToken,
        tokens.refreshToken,
      );

      // Send OTP via email
      await this.emailOtp.sendOtp(email);

      return { requires2FA: true, sessionId, email };
    }

    // No 2FA — check for required actions in the JWT
    const requiredActions = payload.required_actions || payload['required_actions'] || [];

    // Sync user to local database
    await this.syncUser(keycloakUserId, payload, null);

    return {
      requires2FA: false,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        sub: keycloakUserId,
        email: payload.email,
        given_name: payload.given_name,
        family_name: payload.family_name,
        preferred_username: payload.preferred_username,
        realm_access: payload.realm_access,
        required_actions: requiredActions,
      },
    };
  }

  /**
   * Step 2: Verify 2FA code and complete login.
   */
  async verify2FA(
    sessionId: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    // Retrieve pending login session
    const pending = await this.emailOtp.consumePendingLogin(sessionId);
    if (!pending) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Verify OTP
    const result = await this.emailOtp.verifyOtp(pending.email, code);
    if (!result.success) {
      throw new UnauthorizedException(result.message);
    }

    // Parse the access token to get user info
    const payload = this.parseJwt(pending.accessToken);
    const requiredActions = payload?.required_actions || payload?.['required_actions'] || [];

    // Sync user to local database
    await this.syncUser(pending.keycloakUserId, payload, null);

    return {
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      user: {
        sub: pending.keycloakUserId,
        email: payload?.email,
        given_name: payload?.given_name,
        family_name: payload?.family_name,
        preferred_username: payload?.preferred_username,
        realm_access: payload?.realm_access,
        required_actions: requiredActions,
      },
    };
  }

  /**
   * Initiate password reset — sends a reset email.
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    // Find user in Keycloak
    const user = await this.keycloakAdmin.getUserByEmail(email);
    if (!user) {
      // Don't reveal whether the email exists
      return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
    }

    // Generate reset token and send email
    const resetToken = await this.emailOtp.generateResetToken(email, user.id!);
    await this.emailOtp.sendPasswordResetEmail(email, resetToken);

    return { success: true, message: 'If an account with that email exists, a reset link has been sent.' };
  }

  /**
   * Complete password reset with token and new password.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    // Validate reset token
    const tokenData = await this.emailOtp.validateResetToken(token);
    if (!tokenData) {
      throw new BadRequestException('Invalid or expired reset link. Please request a new one.');
    }

    // Validate password strength
    this.validatePassword(newPassword);

    // Reset password in Keycloak
    await this.keycloakAdmin.resetUserPassword(tokenData.keycloakUserId, newPassword);

    // Remove UPDATE_PASSWORD required action if present
    await this.keycloakAdmin.removeRequiredAction(tokenData.keycloakUserId, 'UPDATE_PASSWORD');

    return { success: true, message: 'Password reset successfully. You can now sign in.' };
  }

  /**
   * Change password for an authenticated user.
   * If forceChange is true (required action), skip current password validation.
   */
  async changePassword(
    keycloakUserId: string,
    currentPassword: string,
    newPassword: string,
    forceChange = false,
  ): Promise<{ success: boolean; message: string }> {
    // Validate current password unless this is a forced change (required action)
    if (!forceChange && currentPassword) {
      const user = await this.keycloakAdmin.getUser(keycloakUserId);
      if (!user) {
        throw new BadRequestException('User not found.');
      }

      const username = user.username || user.email;
      if (!username) {
        throw new BadRequestException('Unable to determine username.');
      }

      const valid = await this.keycloakAdmin.validateCredentials(username, currentPassword);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect.');
      }
    }

    // Validate new password strength
    this.validatePassword(newPassword);

    // Set new password
    await this.keycloakAdmin.resetUserPassword(keycloakUserId, newPassword);

    // Remove UPDATE_PASSWORD required action if present
    await this.keycloakAdmin.removeRequiredAction(keycloakUserId, 'UPDATE_PASSWORD');

    return { success: true, message: 'Password changed successfully.' };
  }

  /**
   * Get current user info including required actions.
   */
  async getMe(keycloakUserId: string): Promise<any> {
    const user = await this.keycloakAdmin.getUser(keycloakUserId);
    if (!user) {
      throw new BadRequestException('User not found.');
    }

    // Get org info from attributes
    const orgId = Array.isArray(user.attributes?.orgId)
      ? user.attributes.orgId[0]
      : user.attributes?.orgId;
    const orgName = Array.isArray(user.attributes?.orgName)
      ? user.attributes.orgName[0]
      : user.attributes?.orgName;

    // Check if 2FA is enabled
    const otpEnabled = Array.isArray(user.attributes?.otpEnabled)
      ? user.attributes.otpEnabled[0]
      : user.attributes?.otpEnabled;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      emailVerified: user.emailVerified,
      enabled: user.enabled,
      requiredActions: user.requiredActions || [],
      orgId,
      orgName,
      otpEnabled: otpEnabled === 'true',
      lastLogin: (user as any).lastLoginTimestamp || null,
    };
  }

  /**
   * Enable or disable 2FA for a user.
   */
  async toggle2FA(
    keycloakUserId: string,
    enabled: boolean,
  ): Promise<{ success: boolean; message: string }> {
    await this.keycloakAdmin.setUserAttribute(
      keycloakUserId,
      'otpEnabled',
      enabled ? 'true' : 'false',
    );

    return {
      success: true,
      message: enabled ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.',
    };
  }

  /**
   * Clear a user's required actions (e.g., after completing password update).
   */
  async clearRequiredAction(
    keycloakUserId: string,
    action: string,
  ): Promise<{ success: boolean }> {
    await this.keycloakAdmin.removeRequiredAction(keycloakUserId, action);
    return { success: true };
  }

  /**
   * Sync a Keycloak user to the local Prisma database.
   */
  private async syncUser(keycloakUserId: string, jwtPayload: any, orgId: string | null) {
    try {
      const email = jwtPayload?.email;
      if (!email) return;

      // Find org from Keycloak attributes or JWT
      let resolvedOrgId = orgId;
      if (!resolvedOrgId) {
        const kcUser = await this.keycloakAdmin.getUser(keycloakUserId);
        resolvedOrgId = Array.isArray(kcUser?.attributes?.orgId)
          ? kcUser.attributes.orgId[0]
          : kcUser?.attributes?.orgId || null;
      }

      await this.prisma.user.upsert({
        where: { keycloakUserId },
        update: {
          email,
          firstName: jwtPayload?.given_name || '',
          lastName: jwtPayload?.family_name || '',
          lastLoginAt: new Date(),
        },
        create: {
          organizationId: resolvedOrgId || '',
          keycloakUserId,
          username: email,
          email,
          firstName: jwtPayload?.given_name || '',
          lastName: jwtPayload?.family_name || '',
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
    } catch (error: any) {
      this.logger.warn(`Failed to sync user ${keycloakUserId}: ${error.message}`);
    }
  }

  /**
   * Validate password meets strength requirements.
   */
  private validatePassword(password: string) {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Password must be at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain at least one special character');

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Password validation failed', errors });
    }
  }

  /**
   * Parse a JWT token payload.
   */
  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }
}
