import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
  Get,
  Param,
  Delete,
  Req,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './services/auth-token.service';
import { MailService } from './services/mail.service';
import { InvitationService } from '../invitation/invitation.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { DEFAULT_ROLES } from '../user/default-roles';
import { getErrorMessage } from '../../common/errorHandler';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly authTokens: AuthTokenService,
    private readonly mail: MailService,
    private readonly invitationService: InvitationService,
  ) {}

  /**
   * Register a new organization with an admin user.
   *
   * PUBLIC endpoint — no authentication required.
   *
   * The organization, its default roles, the admin user and the admin's role
   * assignment are created in a single database transaction, so a partial
   * registration cannot happen. (This used to be a multi-step flow that created
   * a Keycloak user and rolled the organization back on failure.)
   */
  @Public()
  @Post('register')
  async registerOrganization(
    @Body() dto: {
      organizationName: string;
      adminFirstName: string;
      adminLastName: string;
      email: string;
      password: string;
    },
  ) {
    // ============================================================
    // STEP 1: VALIDATE ALL INPUT FIRST
    // ============================================================
    const errors: string[] = [];

    if (!dto.organizationName || !dto.organizationName.trim()) {
      errors.push('Organization name is required');
    } else if (dto.organizationName.trim().length < 3) {
      errors.push('Organization name must be at least 3 characters');
    } else if (dto.organizationName.trim().length > 50) {
      errors.push('Organization name must be less than 50 characters');
    }

    if (!dto.adminFirstName || !dto.adminFirstName.trim()) {
      errors.push('First name is required');
    }

    if (!dto.adminLastName || !dto.adminLastName.trim()) {
      errors.push('Last name is required');
    }

    if (!dto.email || !dto.email.trim()) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
      errors.push('Invalid email address');
    }

    if (!dto.password) {
      errors.push('Password is required');
    } else if (dto.password.length < 8) {
      errors.push('Password must be at least 8 characters');
    } else if (!/[A-Z]/.test(dto.password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (!/[a-z]/.test(dto.password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (!/[0-9]/.test(dto.password)) {
      errors.push('Password must contain at least one number');
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(dto.password)) {
      errors.push('Password must contain at least one special character');
    }

    if (errors.length > 0) {
      throw new BadRequestException({ message: 'Validation failed', errors });
    }

    const email = dto.email.trim().toLowerCase();

    const slug = dto.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);

    // ============================================================
    // STEP 2: CHECK FOR DUPLICATES
    // ============================================================
    const existingOrg = await this.prisma.organization.findFirst({
      where: { OR: [{ slug }, { primaryContactEmail: email }] },
    });

    if (existingOrg) {
      const duplicateErrors: string[] = [];
      if (existingOrg.slug === slug) {
        duplicateErrors.push(`An organization with the name "${dto.organizationName}" already exists`);
      }
      if (existingOrg.primaryContactEmail === email) {
        duplicateErrors.push(`An organization with the email "${email}" already exists`);
      }
      throw new BadRequestException({ message: 'Organization already exists', errors: duplicateErrors });
    }

    // An email can only back one account across the whole platform.
    const existingUser = await this.prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      throw new BadRequestException({
        message: 'Email already in use',
        errors: [`The email "${email}" is already registered. Please use a different email or contact support.`],
      });
    }

    // ============================================================
    // STEP 3: CREATE ORG + ROLES + ADMIN USER (ATOMIC)
    // ============================================================
    const passwordHash = await this.auth.hashPassword(dto.password);

    let org: { id: string; name: string };
    try {
      org = await this.prisma.$transaction(async (tx) => {
        const createdOrg = await tx.organization.create({
          data: {
            name: dto.organizationName.trim(),
            slug,
            primaryContactEmail: email,
            phone: '',
            settings: {},
            subscriptionTier: 'free',
          },
        });

        // Create the default roles up front so the admin can be assigned one.
        for (const [key, roleDef] of Object.entries(DEFAULT_ROLES)) {
          await tx.role.create({
            data: {
              organizationId: createdOrg.id,
              name: key,
              description: roleDef.description,
              isSystemRole: roleDef.isSystemRole || false,
              permissions: roleDef.permissions,
            },
          });
        }

        const adminRole = await tx.role.findFirst({
          where: { organizationId: createdOrg.id, name: 'org_admin' },
          select: { id: true },
        });

        const admin = await tx.user.create({
          data: {
            organizationId: createdOrg.id,
            email,
            username: email,
            firstName: dto.adminFirstName.trim(),
            lastName: dto.adminLastName.trim(),
            passwordHash,
            emailVerified: false,
            requiredActions: [],
            isActive: true,
            lastLoginAt: new Date(),
          },
        });

        if (adminRole) {
          await tx.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });
        }

        return { id: createdOrg.id, name: createdOrg.name };
      });
    } catch (error) {
      this.logger.error('Registration failed, no data was committed:', getErrorMessage(error));
      throw new BadRequestException({
        message: 'Registration failed',
        errors: ['An unexpected error occurred. Please try again.'],
      });
    }

    this.logger.log(`Organization created: ${org.name} (${org.id})`);

    // ============================================================
    // STEP 4: SEND VERIFICATION EMAIL (NON-CRITICAL)
    // ============================================================
    let emailSent = false;
    try {
      const admin = await this.auth.getByEmail(email);
      if (admin) {
        const token = await this.authTokens.createVerifyToken(admin.id, admin.email);
        const result = await this.mail.sendVerificationEmail(admin.email, token);
        emailSent = result.success;
      }
    } catch (error) {
      // The account exists and can sign in; verification can be resent later.
      this.logger.warn('Failed to send verification email:', getErrorMessage(error));
    }

    return {
      success: true,
      message: 'Organization registered successfully!',
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: slug,
      adminEmail: email,
      details: {
        organizationCreated: true,
        userCreated: true,
        rolesSeeded: true,
        emailSent,
      },
    };
  }

  /**
   * Check if an organization slug is available.
   */
  @Public()
  @Get('check-slug/:slug')
  async checkSlug(@Param('slug') slug: string) {
    const exists = await this.prisma.organization.findUnique({ where: { slug } });
    return { available: !exists };
  }

  /**
   * Invite a team member to the organization.
   * Requires the users:manage permission.
   */
  @Post('invite')
  @RequirePermissions('users:manage')
  async inviteMember(
    @Req() req: any,
    @Body() dto: {
      email: string;
      firstName?: string;
      lastName?: string;
      roleId?: string;
      role?: string;
      teamIds?: string[];
    },
  ) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];

    return this.invitationService.createInvitation(orgId, req.user?.sub, dto);
  }

  /**
   * Accept an invitation using the email + organization slug.
   * PUBLIC endpoint. Returns a one-time token used to set the account password.
   */
  @Public()
  @Post('accept-invitation')
  async acceptInvitation(@Body() dto: { email: string; orgSlug: string }) {
    if (!dto.email?.trim() || !dto.orgSlug?.trim()) {
      throw new BadRequestException('Email and organization are required');
    }

    return this.invitationService.acceptInvitationByEmail(dto.email, dto.orgSlug);
  }

  /**
   * List invitations for the organization.
   */
  @Get('invitations')
  @RequirePermissions('users:manage')
  async listInvitations(@Req() req: any) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.invitationService.listInvitations(orgId);
  }

  /**
   * Cancel an invitation.
   */
  @Delete('invitations/:id')
  @RequirePermissions('users:manage')
  async cancelInvitation(@Req() req: any, @Param('id') id: string) {
    const orgId = req.user?.orgId || req.headers['x-org-id'];
    return this.invitationService.cancelInvitation(orgId, id);
  }
}
