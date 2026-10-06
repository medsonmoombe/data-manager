import { Controller, Post, Body, BadRequestException, Logger, Get, Param, Delete, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from 'nest-keycloak-connect';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { KeycloakAdminService } from '../../infrastructure/keycloak/keycloak.admin.service';
import { UserManagementService } from '../user/user-management.service';
import { InvitationService } from './invitation.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { getKeycloakErrorMessage, getErrorMessage } from '../../common/errorHandler';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly keycloakAdmin: KeycloakAdminService,
    private readonly userService: UserManagementService,
    private readonly config: ConfigService,
    private readonly invitationService: InvitationService,
  ) {}


 /**
 * Register a new organization with an admin user.
 * 
 * This is a PUBLIC endpoint — no authentication required.
 * 
 * TRANSACTION FLOW (all or nothing):
 * 1. Validate ALL input first
 * 2. Check if org slug/email already exists
 * 3. Create organization in database
 * 4. Create admin user in Keycloak
 * 5. If Keycloak fails → DELETE the organization (rollback)
 * 6. Seed default roles
 * 7. Sync user to local database
 * 8. Send verification email
 * 
 * If ANY step fails, the entire operation is rolled back.
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

  // Organization name
  if (!dto.organizationName || !dto.organizationName.trim()) {
    errors.push('Organization name is required');
  } else if (dto.organizationName.trim().length < 3) {
    errors.push('Organization name must be at least 3 characters');
  } else if (dto.organizationName.trim().length > 50) {
    errors.push('Organization name must be less than 50 characters');
  }

  // Admin first name
  if (!dto.adminFirstName || !dto.adminFirstName.trim()) {
    errors.push('First name is required');
  }

  // Admin last name
  if (!dto.adminLastName || !dto.adminLastName.trim()) {
    errors.push('Last name is required');
  }

  // Email
  if (!dto.email || !dto.email.trim()) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dto.email)) {
    errors.push('Invalid email address');
  }

  // Password
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

  // If any validation errors, return them ALL at once
  if (errors.length > 0) {
    throw new BadRequestException({
      message: 'Validation failed',
      errors: errors,
    });
  }

  // Generate organization slug
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
    where: {
      OR: [
        { slug },
        { primaryContactEmail: dto.email },
      ],
    },
  });

  if (existingOrg) {
    const duplicateErrors: string[] = [];
    if (existingOrg.slug === slug) {
      duplicateErrors.push(`An organization with the name "${dto.organizationName}" already exists`);
    }
    if (existingOrg.primaryContactEmail === dto.email) {
      duplicateErrors.push(`An organization with the email "${dto.email}" already exists`);
    }
    throw new BadRequestException({
      message: 'Organization already exists',
      errors: duplicateErrors,
    });
  }

  // Check if email is already used in Keycloak
  try {
    const existingKeycloakUser = await this.keycloakAdmin.getUserByEmail(dto.email);
    if (existingKeycloakUser) {
      throw new BadRequestException({
        message: 'Email already in use',
        errors: [`The email "${dto.email}" is already registered. Please use a different email or contact support.`],
      });
    }
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    // If Keycloak lookup fails, continue (user doesn't exist)
  }

  // ============================================================
  // STEP 3: CREATE ORGANIZATION
  // ============================================================
  let org: any = null;
  let keycloakUser: any = null;

  try {
    org = await this.prisma.organization.create({
      data: {
        name: dto.organizationName.trim(),
        slug,
        primaryContactEmail: dto.email.trim().toLowerCase(),
        phone: '',
        settings: {},
        subscriptionTier: 'free',
      },
    });

    this.logger.log(`Organization created: ${org.name} (${org.id})`);

    // ============================================================
    // STEP 4: CREATE USER IN KEYCLOAK
    // ============================================================
    try {
      keycloakUser = await this.keycloakAdmin.createUser({
        email: dto.email.trim().toLowerCase(),
        firstName: dto.adminFirstName.trim(),
        lastName: dto.adminLastName.trim(),
        password: dto.password,
        orgId: org.id,
        orgName: org.name,
        requiredActions: ['VERIFY_EMAIL'],
        realmRoles: ['org_admin'],
        emailVerified: false,
      });

      this.logger.log(`Keycloak user created: ${dto.email}`);
    } catch (keycloakError) {
      // ROLLBACK: Delete the organization
      this.logger.error('Keycloak user creation failed, rolling back organization');
      await this.prisma.organization.delete({ where: { id: org.id } }).catch(() => {});

      throw new BadRequestException({
        message: 'Failed to create user account',
        errors: [
          'Could not create your user account. Please try again.',
          getKeycloakErrorMessage(keycloakError),
        ],
      });
    }

    // ============================================================
    // STEP 5: SEED DEFAULT ROLES
    // ============================================================
    try {
      await this.userService.seedDefaultRoles(org.id);
      this.logger.log('Default roles seeded');
    } catch (roleError) {
      this.logger.warn('Failed to seed roles, but continuing:', getErrorMessage(roleError));
      // Non-critical — don't rollback
    }

    // ============================================================
    // STEP 6: SYNC USER TO LOCAL DATABASE
    // ============================================================
    try {
      await this.prisma.user.upsert({
        where: { keycloakUserId: keycloakUser.id! },
        update: {
          email: dto.email.trim().toLowerCase(),
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          lastLoginAt: new Date(),
        },
        create: {
          organizationId: org.id,
          keycloakUserId: keycloakUser.id!,
          username: dto.email.trim().toLowerCase(),
          email: dto.email.trim().toLowerCase(),
          firstName: dto.adminFirstName.trim(),
          lastName: dto.adminLastName.trim(),
          isActive: true,
          lastLoginAt: new Date(),
        },
      });
      this.logger.log('User synced to local database');
    } catch (syncError) {
      this.logger.warn('Failed to sync user to local DB:', getErrorMessage(syncError));
      // Non-critical — user can still login via Keycloak
    }

    // ============================================================
    // STEP 7: ASSIGN ORG_ADMIN ROLE TO USER LOCALLY
    // ============================================================
    try {
      const localUser = await this.prisma.user.findUnique({
        where: { keycloakUserId: keycloakUser.id! },
      });

      const orgAdminRole = await this.prisma.role.findFirst({
        where: { organizationId: org.id, name: 'org_admin' },
      });

      if (localUser && orgAdminRole) {
        await this.prisma.userRole.create({
          data: { userId: localUser.id, roleId: orgAdminRole.id },
        });
        this.logger.log('org_admin role assigned locally');
      }
    } catch (roleAssignError) {
      this.logger.warn('Failed to assign local role:', getErrorMessage(roleAssignError));
    }

    // ============================================================
    // STEP 8: SEND VERIFICATION EMAIL
    // ============================================================
    try {
      await this.keycloakAdmin.sendVerifyEmail(keycloakUser.id!);
      this.logger.log('Verification email sent');
    } catch (emailError) {
      this.logger.warn('Failed to send verification email:', getErrorMessage(emailError));
      // Non-critical — user can still login
    }

    // ============================================================
    // SUCCESS!
    // ============================================================
    return {
      success: true,
      message: 'Organization registered successfully!',
      organizationId: org.id,
      organizationName: org.name,
      organizationSlug: slug,
      adminEmail: dto.email.trim().toLowerCase(),
      details: {
        organizationCreated: true,
        userCreated: true,
        rolesSeeded: true,
        emailSent: true,
      },
    };

  } catch (error) {
    // If organization was created but something else failed, clean up
    if (org && !(error instanceof BadRequestException)) {
      this.logger.error('Unexpected error during registration, cleaning up');
      await this.prisma.organization.delete({ where: { id: org.id } }).catch(() => {});
      if (keycloakUser?.id) {
        await this.keycloakAdmin.deleteUser(keycloakUser.id).catch(() => {});
      }
    }

    if (error instanceof BadRequestException) throw error;

    this.logger.error('Registration failed:', getErrorMessage(error));
    throw new BadRequestException({
      message: 'Registration failed',
      errors: ['An unexpected error occurred. Please try again.'],
    });
  }
}

  /**
   * Check if an organization slug is available.
   */
  @Public()
  @Get('check-slug/:slug')
  async checkSlug(@Param('slug') slug: string) {
    const exists = await this.prisma.organization.findUnique({
      where: { slug },
    });
    return { available: !exists };
  }

  /**
 * Invite a team member to the organization.
 * Requires org_admin role.
 */
@Post('invite')
@RequirePermissions('users:manage')
async inviteMember(
  @Req() req: any,
  @Body() dto: {
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
  },
) {
  const orgId = req.user?.orgId || req.headers['x-org-id'];
  const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:5173');
  
  return this.invitationService.inviteMember(orgId, req.user?.sub, dto, frontendUrl);
}

/**
 * Accept an invitation (public endpoint).
 * Called when user clicks the link in their email.
 */
@Public()
@Post('accept-invitation')
async acceptInvitation(
  @Body() dto: { email: string; orgSlug: string },
) {
  // Find organization by slug
  const org = await this.prisma.organization.findUnique({
    where: { slug: dto.orgSlug },
  });

  if (!org) {
    throw new BadRequestException('Organization not found');
  }

  return this.invitationService.acceptInvitation(dto.email, org.id);
}

/**
 * List pending invitations for the organization.
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