import { Controller, Post, Get, Body, Req, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Public } from 'nest-keycloak-connect';
import { AuthFlowService } from './auth-flow.service';
import { EmailOtpService } from './services/email-otp.service';

/**
 * Auth Flow Controller
 *
 * Custom authentication endpoints that bypass Keycloak's built-in UI.
 * All endpoints are under /auth/api/ to avoid conflicts with the existing
 * /auth/ registration and invitation endpoints.
 */
@Controller('auth/api')
export class AuthFlowController {
  constructor(
    private readonly authFlow: AuthFlowService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  /**
   * Login with username/password.
   * Returns tokens directly if no 2FA, or a session ID if 2FA is required.
   *
   * POST /auth/api/login
   */
  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    if (!body.username?.trim()) {
      throw new BadRequestException('Username is required.');
    }
    if (!body.password) {
      throw new BadRequestException('Password is required.');
    }

    return this.authFlow.login(body.username.trim(), body.password);
  }

  /**
   * Verify 2FA code and complete login.
   *
   * POST /auth/api/2fa/verify
   */
  @Public()
  @Post('2fa/verify')
  async verify2FA(@Body() body: { sessionId: string; code: string }) {
    if (!body.sessionId) {
      throw new BadRequestException('Session ID is required.');
    }
    if (!body.code || body.code.length !== 6) {
      throw new BadRequestException('A valid 6-digit code is required.');
    }

    return this.authFlow.verify2FA(body.sessionId, body.code);
  }

  /**
   * Resend 2FA OTP code.
   * Validates that the session exists before sending to prevent email bombing.
   *
   * POST /auth/api/2fa/resend
   */
  @Public()
  @Post('2fa/resend')
  async resend2FA(@Body() body: { sessionId: string; email: string }) {
    if (!body.sessionId) {
      throw new BadRequestException('Session ID is required.');
    }
    if (!body.email) {
      throw new BadRequestException('Email is required.');
    }

    // Validate session exists (peek without consuming)
    const sessionValid = await this.emailOtp.peekPendingLogin(body.sessionId);
    if (!sessionValid) {
      throw new BadRequestException('Session expired. Please log in again.');
    }

    return this.emailOtp.sendOtp(body.email);
  }

  /**
   * Request password reset email.
   *
   * POST /auth/api/forgot-password
   */
  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    if (!body.email?.trim()) {
      throw new BadRequestException('Email is required.');
    }

    return this.authFlow.forgotPassword(body.email.trim());
  }

  /**
   * Complete password reset with token and new password.
   *
   * POST /auth/api/reset-password
   */
  @Public()
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string; confirmPassword: string }) {
    if (!body.token) {
      throw new BadRequestException('Reset token is required.');
    }
    if (!body.newPassword) {
      throw new BadRequestException('New password is required.');
    }
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }

    return this.authFlow.resetPassword(body.token, body.newPassword);
  }

  /**
   * Change password for an authenticated user.
   * Supports forced change (e.g., required action after registration)
   * where current password validation is skipped.
   *
   * POST /auth/api/change-password
   */
  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body() body: { currentPassword?: string; newPassword: string; confirmPassword: string; forceChange?: boolean },
  ) {
    const keycloakUserId = req.user?.sub;
    if (!keycloakUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!body.newPassword) {
      throw new BadRequestException('New password is required.');
    }
    if (body.newPassword !== body.confirmPassword) {
      throw new BadRequestException('Passwords do not match.');
    }
    if (!body.forceChange && !body.currentPassword) {
      throw new BadRequestException('Current password is required.');
    }

    return this.authFlow.changePassword(
      keycloakUserId,
      body.currentPassword || '',
      body.newPassword,
      body.forceChange || false,
    );
  }

  /**
   * Get current user info including required actions.
   *
   * GET /auth/api/me
   */
  @Get('me')
  async getMe(@Req() req: any) {
    const keycloakUserId = req.user?.sub;
    if (!keycloakUserId) {
      throw new UnauthorizedException('Authentication required.');
    }

    return this.authFlow.getMe(keycloakUserId);
  }

  /**
   * Enable or disable 2FA for the current user.
   *
   * POST /auth/api/2fa/toggle
   */
  @Post('2fa/toggle')
  async toggle2FA(@Req() req: any, @Body() body: { enabled: boolean }) {
    const keycloakUserId = req.user?.sub;
    if (!keycloakUserId) {
      throw new UnauthorizedException('Authentication required.');
    }

    return this.authFlow.toggle2FA(keycloakUserId, body.enabled);
  }

  /**
   * Clear a required action for the current user.
   * Only whitelisted actions can be cleared via this endpoint.
   *
   * POST /auth/api/clear-action
   */
  @Post('clear-action')
  async clearAction(@Req() req: any, @Body() body: { action: string }) {
    const keycloakUserId = req.user?.sub;
    if (!keycloakUserId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!body.action) {
      throw new BadRequestException('Action name is required.');
    }

    const allowedActions = ['UPDATE_PASSWORD', 'VERIFY_EMAIL'];
    if (!allowedActions.includes(body.action)) {
      throw new BadRequestException('This action cannot be cleared via this endpoint.');
    }

    return this.authFlow.clearRequiredAction(keycloakUserId, body.action);
  }
}
