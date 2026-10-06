import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AuthFlowService } from './auth-flow.service';

/**
 * Authentication endpoints.
 *
 * All routes are under /auth/api/ to stay clear of the /auth/ registration and
 * invitation endpoints. Login is direct: credentials in, tokens out.
 */
@Controller('auth/api')
export class AuthFlowController {
  constructor(private readonly authFlow: AuthFlowService) {}

  /**
   * Sign in with email/username and password.
   * POST /auth/api/login
   */
  @Public()
  @Post('login')
  async login(@Body() body: { username?: string; email?: string; password: string }) {
    const identifier = (body.username || body.email || '').trim();
    if (!identifier) {
      throw new BadRequestException('Email is required.');
    }
    if (!body.password) {
      throw new BadRequestException('Password is required.');
    }

    return this.authFlow.login(identifier, body.password);
  }

  /**
   * Exchange a refresh token for a new access token (refresh token rotates).
   * POST /auth/api/refresh
   */
  @Public()
  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new BadRequestException('Refresh token is required.');
    }

    return this.authFlow.refresh(body.refreshToken);
  }

  /**
   * Revoke a refresh token.
   * POST /auth/api/logout
   */
  @Public()
  @Post('logout')
  async logout(@Body() body: { refreshToken?: string }) {
    return this.authFlow.logout(body.refreshToken);
  }

  /**
   * Request a password reset email.
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
   * Complete a password reset with a one-time token.
   * POST /auth/api/reset-password
   */
  @Public()
  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; newPassword: string; confirmPassword: string },
  ) {
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
   * Verify an email address using the token from the verification email.
   * POST /auth/api/verify-email
   */
  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('Verification token is required.');
    }

    return this.authFlow.verifyEmail(body.token);
  }

  /**
   * Change the password of the signed-in user.
   * Supports the forced change (UPDATE_PASSWORD required action) where the
   * current password is not required.
   * POST /auth/api/change-password
   */
  @Post('change-password')
  async changePassword(
    @Req() req: any,
    @Body()
    body: {
      currentPassword?: string;
      newPassword: string;
      confirmPassword: string;
      forceChange?: boolean;
    },
  ) {
    const userId = req.user?.sub;
    if (!userId) {
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
      userId,
      body.currentPassword || '',
      body.newPassword,
      body.forceChange || false,
    );
  }

  /**
   * Current user profile including pending required actions.
   * GET /auth/api/me
   */
  @Get('me')
  async getMe(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    return this.authFlow.getMe(userId);
  }

  /**
   * Re-send the email verification link for the signed-in user.
   * POST /auth/api/resend-verification
   */
  @Post('resend-verification')
  async resendVerification(@Req() req: any) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    return this.authFlow.resendVerification(userId);
  }

  /**
   * Clear a required action for the signed-in user.
   * Only whitelisted actions can be cleared via this endpoint.
   * POST /auth/api/clear-action
   */
  @Post('clear-action')
  async clearAction(@Req() req: any, @Body() body: { action: string }) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }
    if (!body.action) {
      throw new BadRequestException('Action name is required.');
    }

    const allowedActions = ['UPDATE_PASSWORD', 'VERIFY_EMAIL'];
    if (!allowedActions.includes(body.action)) {
      throw new BadRequestException('This action cannot be cleared via this endpoint.');
    }

    return this.authFlow.clearRequiredAction(userId, body.action);
  }
}
