import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

interface OtpRecord {
  code: string;
  attempts: number;
  createdAt: number;
}

interface PendingLogin {
  keycloakUserId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  createdAt: number;
}

@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);
  private readonly OTP_TTL_MS = 5 * 60 * 1000;       // 5 minutes
  private readonly PENDING_LOGIN_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ATTEMPTS = 5;
  private readonly RATE_LIMIT_MS = 2 * 60 * 1000;    // 2 minutes between sends
  private transporter!: nodemailer.Transporter;

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.config.get('SMTP_PORT', 587),
      secure: this.config.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get('SMTP_USER', ''),
        pass: this.config.get('SMTP_PASSWORD', ''),
      },
    });
  }

  /**
   * Generate a 6-digit OTP, store it, and send it via email.
   */
  async sendOtp(email: string): Promise<{ success: boolean; message: string }> {
    const cacheKey = `otp:${email}`;
    const rateLimitKey = `otp_rate:${email}`;

    // Rate limit check
    const lastSent = await this.cache.get<number>(rateLimitKey);
    if (lastSent && Date.now() - lastSent < this.RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((this.RATE_LIMIT_MS - (Date.now() - lastSent)) / 1000);
      return {
        success: false,
        message: `Please wait ${waitSeconds} seconds before requesting another code.`,
      };
    }

    // Generate 6-digit OTP
    const code = crypto.randomInt(100000, 999999).toString();

    // Store in cache
    const record: OtpRecord = { code, attempts: 0, createdAt: Date.now() };
    await this.cache.set(cacheKey, record, this.OTP_TTL_MS);

    // Set rate limit
    await this.cache.set(rateLimitKey, Date.now(), this.RATE_LIMIT_MS);

    // Send email
    try {
      await this.sendOtpEmail(email, code);
      this.logger.log(`OTP sent to ${email}`);
      return { success: true, message: 'Verification code sent to your email.' };
    } catch (error: any) {
      this.logger.error(`Failed to send OTP to ${email}: ${error.message}`);
      return { success: false, message: 'Failed to send verification code. Please try again.' };
    }
  }

  /**
   * Verify an OTP code.
   */
  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ success: boolean; message: string }> {
    const cacheKey = `otp:${email}`;
    const record = await this.cache.get<OtpRecord>(cacheKey);

    if (!record) {
      return { success: false, message: 'No verification code found. Please request a new one.' };
    }

    // Check expiry
    if (Date.now() - record.createdAt > this.OTP_TTL_MS) {
      await this.cache.del(cacheKey);
      return { success: false, message: 'Verification code has expired. Please request a new one.' };
    }

    // Check attempts
    if (record.attempts >= this.MAX_ATTEMPTS) {
      await this.cache.del(cacheKey);
      return { success: false, message: 'Too many failed attempts. Please request a new code.' };
    }

    // Increment attempts
    record.attempts += 1;
    await this.cache.set(cacheKey, record, this.OTP_TTL_MS);

    // Verify code
    if (record.code !== code) {
      return { success: false, message: 'Invalid verification code. Please try again.' };
    }

    // Success — delete the OTP
    await this.cache.del(cacheKey);
    return { success: true, message: 'Verification code confirmed.' };
  }

  /**
   * Store a pending login session (after credential validation but before 2FA completion).
   */
  async storePendingLogin(
    email: string,
    keycloakUserId: string,
    accessToken: string,
    refreshToken: string,
  ): Promise<string> {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const cacheKey = `pending_login:${sessionId}`;

    const pending: PendingLogin = {
      keycloakUserId,
      email,
      accessToken,
      refreshToken,
      createdAt: Date.now(),
    };

    await this.cache.set(cacheKey, pending, this.PENDING_LOGIN_TTL_MS);
    return sessionId;
  }

  /**
   * Peek at a pending login session without consuming it.
   * Used to validate that a session exists (e.g., for resend OTP).
   */
  async peekPendingLogin(sessionId: string): Promise<boolean> {
    const cacheKey = `pending_login:${sessionId}`;
    const pending = await this.cache.get<PendingLogin>(cacheKey);
    return !!pending;
  }

  /**
   * Retrieve and consume a pending login session.
   */
  async consumePendingLogin(
    sessionId: string,
  ): Promise<PendingLogin | null> {
    const cacheKey = `pending_login:${sessionId}`;
    const pending = await this.cache.get<PendingLogin>(cacheKey);

    if (!pending) return null;

    // Consume (delete) the session
    await this.cache.del(cacheKey);
    return pending;
  }

  /**
   * Generate a password reset token (JWT-like, stored in Redis).
   */
  async generateResetToken(
    email: string,
    keycloakUserId: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const cacheKey = `reset_token:${token}`;

    await this.cache.set(cacheKey, { email, keycloakUserId, createdAt: Date.now() }, 60 * 60 * 1000); // 1 hour
    return token;
  }

  /**
   * Validate a password reset token.
   */
  async validateResetToken(
    token: string,
  ): Promise<{ email: string; keycloakUserId: string } | null> {
    const cacheKey = `reset_token:${token}`;
    const data = await this.cache.get<{ email: string; keycloakUserId: string }>(cacheKey);

    if (!data) return null;

    // Consume the token
    await this.cache.del(cacheKey);
    return data;
  }

  /**
   * Send the OTP email with a branded template.
   */
  private async sendOtpEmail(email: string, code: string): Promise<void> {
    const appName = this.config.get('APP_NAME', 'OmniCore Africa');
    const fromEmail = this.config.get('SMTP_FROM', this.config.get('SMTP_USER', ''));
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F3F4F8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(160deg,#007A2E 0%,#009B3A 40%,#006828 100%);padding:32px 40px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">OC</div>
        <span style="color:#fff;font-weight:bold;font-size:16px;">${appName}</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px 0;">Verify Your Identity</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">Enter the code below to complete sign-in</p>
    </div>
    <div style="padding:40px;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;background:#F7F8FA;border:2px dashed #E3E7EE;border-radius:12px;padding:16px 32px;">
          <span style="font-size:32px;font-weight:700;color:#1A1F2E;letter-spacing:8px;font-family:'Courier New',monospace;">${code}</span>
        </div>
      </div>
      <p style="color:#5F6880;font-size:13px;text-align:center;margin:0 0 24px 0;line-height:1.6;">
        This verification code will expire in <strong>5 minutes</strong>.<br>
        If you didn't request this code, please ignore this email.
      </p>
      <div style="border-top:1px solid #E3E7EE;padding-top:20px;margin-top:20px;">
        <p style="color:#99A1B3;font-size:11px;text-align:center;margin:0;">
          This is an automated security email from ${appName}.<br>
          Do not share this code with anyone.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

    await this.transporter.sendMail({
      from: `"${appName}" <${fromEmail}>`,
      to: email,
      subject: `Your verification code: ${code}`,
      html,
      text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes. If you didn't request this, ignore this email.`,
    });
  }

  /**
   * Send a password reset email with a branded template.
   */
  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<{ success: boolean; message: string }> {
    const appName = this.config.get('APP_NAME', 'OmniCore Africa');
    const fromEmail = this.config.get('SMTP_FROM', this.config.get('SMTP_USER', ''));
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;


    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#F3F4F8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
    <div style="background:linear-gradient(160deg,#007A2E 0%,#009B3A 40%,#006828 100%);padding:32px 40px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:14px;">OC</div>
        <span style="color:#fff;font-weight:bold;font-size:16px;">${appName}</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px 0;">Reset Your Password</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">We received a request to reset your password</p>
    </div>
    <div style="padding:40px;">
      <p style="color:#5F6880;font-size:13px;line-height:1.6;margin:0 0 24px 0;">
        Click the button below to set a new password for your account. This link will expire in <strong>1 hour</strong>.
      </p>
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${resetUrl}" style="display:inline-block;background:#009B3A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 2px 10px rgba(0,155,58,0.22);">
          Reset Password
        </a>
      </div>
      <p style="color:#99A1B3;font-size:11px;text-align:center;margin:0;line-height:1.6;">
        If you didn't request a password reset, you can safely ignore this email.<br>
        Your password will not be changed unless you click the link above.
      </p>
    </div>
  </div>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: `"${appName}" <${fromEmail}>`,
        to: email,
        subject: `Reset your ${appName} password`,
        html,
        text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
      });
      return { success: true, message: 'Password reset email sent.' };
    } catch (error: any) {
      this.logger.error(`Failed to send reset email to ${email}: ${error.message}`);
      return { success: false, message: 'Failed to send reset email. Please try again.' };
    }
  }
}
