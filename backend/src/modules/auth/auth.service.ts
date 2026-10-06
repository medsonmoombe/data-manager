import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TokenService } from '../../infrastructure/jwt/token.service';

const BCRYPT_ROUNDS = 12;

export interface CreateUserData {
  organizationId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  password?: string;
  roleNames?: string[];
  requiredActions?: string[];
  emailVerified?: boolean;
}

/**
 * Local identity management. Replaces `KeycloakAdminService`.
 *
 * Every method that used to hit the Keycloak Admin API now reads or writes the
 * `users` table. Passwords are bcrypt hashes in `User.passwordHash`.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  // ---------------------------------------------------------------
  // Passwords
  // ---------------------------------------------------------------

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
    if (!hash) return Promise.resolve(false);
    return bcrypt.compare(password, hash);
  }

  // ---------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------

  getById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { organization: { select: { id: true, name: true } } },
    });
  }

  getByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase() },
      include: { organization: { select: { id: true, name: true } } },
    });
  }

  /** Resolve a login identifier that may be an email or a username. */
  getByLoginIdentifier(identifier: string) {
    const value = identifier.trim();
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { email: value.toLowerCase() },
          { username: value },
        ],
      },
      include: {
        organization: { select: { id: true, name: true } },
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });
  }

  // ---------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------

  /**
   * Create a local user. Replaces `KeycloakAdminService.createUser`.
   * Roles are assigned by name within the target organization.
   */
  async createUser(data: CreateUserData) {
    const email = data.email.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) {
      throw new BadRequestException(`The email "${email}" is already registered.`);
    }

    const passwordHash = data.password ? await this.hashPassword(data.password) : null;

    const user = await this.prisma.user.create({
      data: {
        organizationId: data.organizationId,
        email,
        username: data.username ?? email,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        passwordHash,
        emailVerified: data.emailVerified ?? false,
        requiredActions: data.requiredActions ?? [],
        isActive: true,
      },
    });

    if (data.roleNames?.length) {
      await this.assignRolesByName(user.id, data.organizationId, data.roleNames);
    }

    this.logger.log(`User created: ${email} (${user.id})`);
    return user;
  }

  /** Assign roles to a user by role name within their organization (idempotent). */
  async assignRolesByName(userId: string, organizationId: string, roleNames: string[]) {
    for (const name of roleNames) {
      const role = await this.prisma.role.findFirst({
        where: { organizationId, name },
        select: { id: true },
      });

      if (!role) {
        this.logger.warn(`Role "${name}" not found in organization ${organizationId}; skipping`);
        continue;
      }

      const alreadyAssigned = await this.prisma.userRole.findUnique({
        where: { userId_roleId: { userId, roleId: role.id } },
      });
      if (alreadyAssigned) continue;

      await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    }
  }

  /**
   * Validate credentials. Replaces `KeycloakAdminService.validateCredentials`,
   * which used to return Keycloak tokens — this returns the user row instead.
   *
   * Never throws, so the caller decides what to reveal. The `reason`
   * distinguishes the cases rather than collapsing them into `null`, because
   * an account with no password (invited, or carried over from Keycloak) needs
   * a different message from a wrong password or an inactive account.
   */
  async validateCredentials(
    identifier: string,
    password: string,
  ): Promise<
    | { ok: true; user: NonNullable<Awaited<ReturnType<AuthService['getByLoginIdentifier']>>> }
    | { ok: false; reason: 'unknown' | 'inactive' | 'no-password' | 'bad-password' }
  > {
    const user = await this.getByLoginIdentifier(identifier);
    if (!user) return { ok: false, reason: 'unknown' };

    if (!user.passwordHash) return { ok: false, reason: 'no-password' };

    if (!user.isActive) return { ok: false, reason: 'inactive' };

    const valid = await this.verifyPassword(user.passwordHash, password);
    if (!valid) return { ok: false, reason: 'bad-password' };

    return { ok: true, user };
  }

  /** Set a new password and clear the UPDATE_PASSWORD required action. */
  async setPassword(userId: string, newPassword: string) {
    const passwordHash = await this.hashPassword(newPassword);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { requiredActions: true },
    });
    if (!user) throw new BadRequestException('User not found.');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        requiredActions: user.requiredActions.filter((a) => a !== 'UPDATE_PASSWORD'),
      },
    });

    this.logger.log(`Password updated for user ${userId}`);
  }

  /** Remove a single required action, e.g. after the user completes it. */
  async clearRequiredAction(userId: string, action: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { requiredActions: true },
    });
    if (!user) return;

    const next = user.requiredActions.filter((a) => a !== action);
    if (next.length === user.requiredActions.length) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: { requiredActions: next },
    });
  }

  async setEmailVerified(userId: string, verified: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: verified },
    });
  }

  /** Soft-delete: deactivate instead of destroying audit history. */
  async deactivateUser(userId: string) {
    await this.prisma.user
      .update({ where: { id: userId }, data: { isActive: false } })
      .catch(() => undefined);
  }

  async recordLogin(userId: string) {
    await this.prisma.user
      .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
      .catch(() => undefined);
  }

  // ---------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------

  /**
   * Build the client-facing session for a user: access token, refresh token and
   * the `user` object the frontend (and `req.user`) already expect.
   */
  async buildSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: { select: { id: true, name: true } },
        userRoles: { include: { role: { select: { name: true } } } },
      },
    });

    if (!user) throw new UnauthorizedException('User not found.');
    if (!user.isActive) throw new UnauthorizedException('This account has been deactivated.');

    const roles = user.userRoles.map((ur) => ur.role.name);

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      email: user.email,
      orgId: user.organizationId,
      given_name: user.firstName ?? '',
      family_name: user.lastName ?? '',
      preferred_username: user.username ?? user.email,
      realm_access: { roles },
      required_actions: user.requiredActions,
    });

    const refreshToken = await this.tokenService.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        sub: user.id,
        email: user.email,
        given_name: user.firstName ?? '',
        family_name: user.lastName ?? '',
        preferred_username: user.username ?? user.email,
        orgId: user.organizationId,
        orgName: user.organization?.name ?? null,
        realm_access: { roles },
        required_actions: user.requiredActions,
      },
    };
  }
}
