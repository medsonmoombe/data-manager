import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Transactional auth email (password reset, email verification, invitations).
 *
 * Uses the env-driven SMTP account (`SMTP_*`), the same one the OTP service used.
 * Deliberately NOT the per-organization `EmailSmtpProvider` notification channel:
 * auth mail must work for an organization that has not configured a channel yet,
 * otherwise invitations silently fail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure: this.config.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get('SMTP_USER', ''),
        pass: this.config.get('SMTP_PASSWORD', ''),
      },
    });
  }

  private get appName(): string {
    return this.config.get('APP_NAME', 'OmniCore Africa');
  }

  private get from(): string {
    const addr = this.config.get('SMTP_FROM', this.config.get('SMTP_USER', ''));
    return `"${this.appName}" <${addr}>`;
  }

  private get frontendUrl(): string {
    return this.config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  /** Shared branded shell so all auth emails look consistent. */
  private shell(options: { heading: string; subheading: string; bodyHtml: string }): string {
    return `
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
        <span style="color:#fff;font-weight:bold;font-size:16px;">${this.appName}</span>
      </div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px 0;">${options.heading}</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0;">${options.subheading}</p>
    </div>
    <div style="padding:40px;">
      ${options.bodyHtml}
      <div style="border-top:1px solid #E3E7EE;padding-top:20px;margin-top:20px;">
        <p style="color:#99A1B3;font-size:11px;text-align:center;margin:0;">
          This is an automated message from ${this.appName}. If you didn't request it, you can ignore it.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private button(href: string, label: string): string {
    return `<div style="text-align:center;margin:0 0 32px 0;">
      <a href="${href}" style="display:inline-block;background:#009B3A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 2px 10px rgba(0,155,58,0.22);">${label}</a>
    </div>`;
  }

  async sendPasswordResetEmail(
    email: string,
    resetToken: string,
  ): Promise<{ success: boolean; message: string }> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${resetToken}`;

    const html = this.shell({
      heading: 'Reset Your Password',
      subheading: 'We received a request to reset your password',
      bodyHtml: `
        <p style="color:#5F6880;font-size:13px;line-height:1.6;margin:0 0 24px 0;">
          Click the button below to set a new password for your account. This link will expire in <strong>1 hour</strong>.
        </p>
        ${this.button(resetUrl, 'Reset Password')}
        <p style="color:#99A1B3;font-size:11px;text-align:center;margin:0;line-height:1.6;">
          If you didn't request a password reset, you can safely ignore this email. Your password will not be changed unless you click the link above.
        </p>`,
    });

    return this.send(email, `Reset your ${this.appName} password`, html, `Reset your password: ${resetUrl}`);
  }

  async sendVerificationEmail(
    email: string,
    verifyToken: string,
  ): Promise<{ success: boolean; message: string }> {
    const verifyUrl = `${this.frontendUrl}/verify-email?token=${verifyToken}`;

    const html = this.shell({
      heading: 'Verify Your Email',
      subheading: 'Confirm your email address to finish setting up your account',
      bodyHtml: `
        <p style="color:#5F6880;font-size:13px;line-height:1.6;margin:0 0 24px 0;">
          Click the button below to verify your email address. This link will expire in <strong>24 hours</strong>.
        </p>
        ${this.button(verifyUrl, 'Verify Email')}
        <p style="color:#99A1B3;font-size:11px;text-align:center;margin:0;line-height:1.6;">
          If you didn't create an account, you can safely ignore this email.
        </p>`,
    });

    return this.send(email, `Verify your ${this.appName} email`, html, `Verify your email: ${verifyUrl}`);
  }

  async sendInvitationEmail(
    email: string,
    options: { orgName: string; acceptUrl: string },
  ): Promise<{ success: boolean; message: string }> {
    const html = this.shell({
      heading: "You're Invited",
      subheading: `Join ${options.orgName} on ${this.appName}`,
      bodyHtml: `
        <p style="color:#5F6880;font-size:13px;line-height:1.6;margin:0 0 24px 0;">
          An account has been created for <strong>${email}</strong> at <strong>${options.orgName}</strong>.
          Accept the invitation and set your password to get started.
        </p>
        ${this.button(options.acceptUrl, 'Accept Invitation')}
        <p style="color:#99A1B3;font-size:11px;text-align:center;margin:0;line-height:1.6;">
          This invitation expires in 7 days. If you weren't expecting it, you can ignore this email.
        </p>`,
    });

    return this.send(
      email,
      `You've been invited to ${options.orgName} on ${this.appName}`,
      html,
      `Accept your invitation: ${options.acceptUrl}`,
    );
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html, text });
      this.logger.log(`Email sent to ${to}: ${subject}`);
      return { success: true, message: 'Email sent.' };
    } catch (error: any) {
      this.logger.error(`Failed to send "${subject}" to ${to}: ${error.message}`);
      return { success: false, message: 'Failed to send email. Please try again.' };
    }
  }
}
