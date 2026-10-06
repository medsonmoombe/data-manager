import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class OtpService {
  private readonly otpExpiryMinutes = 10;
  private readonly maxAttempts = 3;

  // In-memory OTP store (use Redis in production)
  private otpStore = new Map<string, { code: string; attempts: number; expiresAt: Date }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate and send OTP to citizen's phone.
   * In production, this sends via SMS/WhatsApp.
   * For now, we return it in the response (dev mode).
   */
  async sendOtp(phone: string): Promise<{ success: boolean; otp?: string; message: string }> {
    // Clean phone number
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Rate limit: only 1 OTP per 2 minutes
    const existing = this.otpStore.get(cleanPhone);
    if (existing && (Date.now() - existing.expiresAt.getTime()) < 2 * 60 * 1000) {
      return { success: false, message: 'Please wait 2 minutes before requesting another OTP' };
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // Store
    this.otpStore.set(cleanPhone, {
      code: otp,
      attempts: 0,
      expiresAt: new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000),
    });

    // In production: send via SMS/WhatsApp
    // await this.notificationService.send({ channel: 'sms', recipient: cleanPhone, message: `Your OTP: ${otp}` });

    return {
      success: true,
      otp: process.env.NODE_ENV === 'development' ? otp : undefined,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verify OTP and return a session token.
   */
  async verifyOtp(phone: string, otp: string): Promise<{ success: boolean; token?: string; message: string }> {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const stored = this.otpStore.get(cleanPhone);

    if (!stored) {
      return { success: false, message: 'No OTP requested for this number' };
    }

    if (new Date() > stored.expiresAt) {
      this.otpStore.delete(cleanPhone);
      return { success: false, message: 'OTP expired. Please request a new one' };
    }

    stored.attempts++;
    if (stored.attempts > this.maxAttempts) {
      this.otpStore.delete(cleanPhone);
      return { success: false, message: 'Too many attempts. Please request a new OTP' };
    }

    if (stored.code !== otp) {
      return { success: false, message: 'Invalid OTP' };
    }

    // OTP verified — generate a short-lived session token
    this.otpStore.delete(cleanPhone);

    const token = crypto.randomBytes(32).toString('hex');
    // Store token → phone mapping (in production: Redis with 15-min expiry)
    this.otpStore.set(`session_${token}`, {
      code: cleanPhone,
      attempts: 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    return { success: true, token, message: 'OTP verified' };
  }

  /**
   * Validate a session token and return the phone number.
   */
  validateSession(token: string): string | null {
    const session = this.otpStore.get(`session_${token}`);
    if (!session || new Date() > session.expiresAt) {
      this.otpStore.delete(`session_${token}`);
      return null;
    }
    return session.code; // Returns phone number
  }
}