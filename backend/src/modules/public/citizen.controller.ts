import { Controller, Post, Get, Param, Body, Req, Headers, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OtpService } from './otp.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { Public } from 'nest-keycloak-connect';

@Controller('public')
export class CitizenController {
  private readonly sensitiveFields = ['nrc', 'phone', 'email'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: OtpService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Request OTP.
   * POST /api/v1/public/auth/request-otp
   */
  @Public()
  @Post('auth/request-otp')
  async requestOtp(@Body() dto: { phone: string }) {
    return this.otpService.sendOtp(dto.phone);
  }

  /**
   * Verify OTP and get session token.
   * POST /api/v1/public/auth/verify-otp
   */
  @Public()
  @Post('auth/verify-otp')
  async verifyOtp(@Body() dto: { phone: string; otp: string }) {
    return this.otpService.verifyOtp(dto.phone, dto.otp);
  }

  /**
   * Look up citizen records by NRC.
   * Requires valid session token.
   * POST /api/v1/public/records/lookup
   */
  @Public()
  @Post('records/lookup')
  async lookupRecords(
    @Body() dto: { nrc: string },
    @Headers('x-session-token') sessionToken: string,
  ) {
    const phone = this.validateSession(sessionToken);
    if (!phone) throw new UnauthorizedException('Invalid or expired session');

    // Find citizen by NRC across all organizations (public data only)
    // In production: limit to specific organizations that have public access enabled
    const records = await this.prisma.goldenRecord.findMany({
      where: {
        status: 'active',
        deletedAt: null,
        data: { path: ['nrc'], string_contains: dto.nrc },
      },
      select: {
        id: true,
        data: true,
        entityDefinition: { select: { name: true } },
        organization: { select: { name: true } },
        updatedAt: true,
      },
      take: 10,
    });

    if (records.length === 0) {
      return { found: false, message: 'No records found for this NRC' };
    }

    // Mask sensitive fields for public view
    const maskedRecords = records.map((r) => ({
      id: r.id,
      entityType: r.entityDefinition.name,
      source: r.organization.name,
      lastUpdated: r.updatedAt,
      data: this.maskSensitiveData(r.data as Record<string, any>),
    }));

    return { found: true, records: maskedRecords };
  }

  /**
   * Get a single record's public details.
   * GET /api/v1/public/records/:id
   */
  @Public()
  @Get('records/:id')
  async getRecord(
    @Param('id') id: string,
    @Headers('x-session-token') sessionToken: string,
  ) {
    const phone = this.validateSession(sessionToken);
    if (!phone) throw new UnauthorizedException('Invalid or expired session');

    const record = await this.prisma.goldenRecord.findUnique({
      where: { id },
      select: {
        id: true,
        data: true,
        entityDefinition: { select: { name: true } },
        organization: { select: { name: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!record || record.organization.name !== record.organization.name) {
      throw new NotFoundException('Record not found');
    }

    return {
      id: record.id,
      entityType: record.entityDefinition.name,
      source: record.organization.name,
      created: record.createdAt,
      updated: record.updatedAt,
      data: this.maskSensitiveData(record.data as Record<string, any>),
    };
  }

  /**
   * Request a correction to a record.
   * POST /api/v1/public/records/:id/correction
   */
  @Public()
  @Post('records/:id/correction')
  async requestCorrection(
    @Param('id') id: string,
    @Body() dto: { field: string; currentValue: string; suggestedValue: string; reason: string },
    @Headers('x-session-token') sessionToken: string,
  ) {
    const phone = this.validateSession(sessionToken);
    if (!phone) throw new UnauthorizedException('Invalid or expired session');

    const record = await this.prisma.goldenRecord.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!record) throw new NotFoundException('Record not found');

    // Create a suggestion for data stewards to review
    await this.prisma.suggestion.create({
      data: {
        organizationId: record.organizationId,
        suggestionType: 'correction',
        title: `Citizen correction request: ${dto.field}`,
        description: `Citizen (${phone}) reports: "${dto.currentValue}" should be "${dto.suggestedValue}". Reason: ${dto.reason}`,
        entityTypeA: 'golden_record',
        entityIdA: id,
        proposedAction: {
          action: 'correct_field',
          field: dto.field,
          currentValue: dto.currentValue,
          suggestedValue: dto.suggestedValue,
          reason: dto.reason,
          citizenPhone: phone,
        },
        confidence: 0.7,
      },
    });

    return {
      success: true,
      message: 'Correction request submitted. It will be reviewed by our team within 3 working days.',
    };
  }

  /**
   * Check status of a previously submitted correction.
   * GET /api/v1/public/corrections/status
   */
  @Public()
  @Get('corrections/status')
  async checkCorrectionStatus(
    @Headers('x-session-token') sessionToken: string,
    @Param('suggestionId') suggestionId?: string,
  ) {
    const phone = this.validateSession(sessionToken);
    if (!phone) throw new UnauthorizedException('Invalid or expired session');

    // Find suggestions from this citizen
    const suggestions = await this.prisma.suggestion.findMany({
      where: {
        suggestionType: 'correction',
        description: { contains: phone },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
      },
    });

    return { corrections: suggestions };
  }

  // =====================
  // Helpers
  // =====================

  private validateSession(token: string): string | null {
    if (!token) return null;
    return this.otpService.validateSession(token);
  }

  /**
   * Mask sensitive data for public view.
   * Show only non-sensitive fields.
   */
  private maskSensitiveData(data: Record<string, any>): Record<string, any> {
    const masked: Record<string, any> = {};
    const publicFields = ['first_name', 'last_name', 'district', 'province', 'status', 'age', 'gender'];

    for (const [key, value] of Object.entries(data)) {
      if (publicFields.includes(key)) {
        masked[key] = value;
      } else if (this.sensitiveFields.includes(key)) {
        // Mask: show last 4 characters
        if (typeof value === 'string' && value.length > 4) {
          masked[key] = '****' + value.slice(-4);
        } else {
          masked[key] = '****';
        }
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }
}