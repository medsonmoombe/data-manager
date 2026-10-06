import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KcAdminClient from '@keycloak/keycloak-admin-client';

/**
 * Keycloak Admin Service
 * 
 * This service uses the Keycloak Admin REST API to:
 * - Create users (when org admin invites team members)
 * - Send verification emails
 * - Send password reset emails
 * - Assign realm roles to users
 * - Set required actions (like UPDATE_PASSWORD)
 * 
 * CREDENTIALS: Uses a Keycloak service account with admin privileges.
 * Configure these in your .env file.
 */
@Injectable()
export class KeycloakAdminService implements OnModuleInit {
  private readonly logger = new Logger(KeycloakAdminService.name);
  private adminClient!: KcAdminClient;
  private realm: string;

  constructor(private config: ConfigService) {
    this.realm = this.config.get<string>('KEYCLOAK_REALM', 'omnicore');
  }

  /**
   * Initialize the Keycloak Admin Client on module startup.
   * Authenticates using a service account with admin privileges.
   */
  async onModuleInit() {
    this.adminClient = new KcAdminClient({
      baseUrl: this.config.get<string>('KEYCLOAK_URL', 'http://localhost:8080'),
      realmName: this.realm,
    });

    try {
      await this.adminClient.auth({
        grantType: 'client_credentials',
        clientId: this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
        clientSecret: this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_SECRET', ''),
      });
      this.logger.log('✅ Keycloak Admin Client authenticated');
    } catch {
      this.logger.warn('⚠️ Keycloak Admin Client not authenticated. User management features will be limited.');
      this.logger.warn('   Configure KEYCLOAK_ADMIN_CLIENT_ID and KEYCLOAK_ADMIN_CLIENT_SECRET in .env');
    }
  }

  private keycloakAvailable = false;

  /**
   * Re-authenticate if the token has expired.
   */
  private async ensureAuth(): Promise<boolean> {
    try {
      await this.adminClient.auth({
        grantType: 'client_credentials',
        clientId: this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_ID', 'admin-cli'),
        clientSecret: this.config.get<string>('KEYCLOAK_ADMIN_CLIENT_SECRET', ''),
      });
      this.keycloakAvailable = true;
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to authenticate with Keycloak`, error.message);
      this.keycloakAvailable = false;
      return false;
    }
  }

  /**
   * Create a new user in Keycloak.
   * 
   * @param data - User details
   * @param data.email - User's email (also used as username)
   * @param data.firstName - First name
   * @param data.lastName - Last name
   * @param data.password - Temporary password (user will be forced to change it)
   * @param data.orgId - Organization ID (stored as custom attribute)
   * @param data.requiredActions - Actions user must complete on first login (e.g., UPDATE_PASSWORD)
   * @param data.realmRoles - Roles to assign (e.g., org_admin, org_member)
   */
  async createUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    orgId: string;
    orgName?: string;
    requiredActions?: string[];
    realmRoles?: string[];
    emailVerified?: boolean;
  }) {
    const authed = await this.ensureAuth();
    if (!authed) {
      this.logger.warn(`Skipping Keycloak user creation for ${data.email} — Keycloak unavailable`);
      return null;
    }

    try {
      // Step 1: Create the user
      const user = await this.adminClient.users.create({
        realm: this.realm,
        username: data.email,          // Email as username for simplicity
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        enabled: true,
        emailVerified: data.emailVerified || false,
        credentials: [
          {
            type: 'password',
            value: data.password,
            temporary: true,            // User must change on first login
          },
        ],
        requiredActions: data.requiredActions || ['UPDATE_PASSWORD'],
        attributes: {
          orgId: data.orgId,            // Links user to their organization
          orgName: data.orgName || '',
        },
      });

      this.logger.log(`User created in Keycloak: ${data.email} (ID: ${user.id})`);

      // Step 2: Assign realm roles if specified
      if (data.realmRoles && data.realmRoles.length > 0) {
        for (const roleName of data.realmRoles) {
          await this.assignRealmRole(user.id, roleName);
        }
      }

      return user;
    } catch (error: any) {
      this.logger.error(`Failed to create user ${data.email}:`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Assign a realm role to a user.
   * Realm roles are defined in Keycloak (e.g., org_admin, org_member).
   */
  async assignRealmRole(userId: string, roleName: string) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      // Get the role
      const role = await this.adminClient.roles.findOneByName({
        realm: this.realm,
        name: roleName,
      });

      if (!role) {
        this.logger.warn(`Role "${roleName}" not found in Keycloak realm`);
        return;
      }

      // Assign role to user
      await this.adminClient.users.addRealmRoleMappings({
        realm: this.realm,
        id: userId,
        roles: [{ id: role.id!, name: role.name! }],
      });

      this.logger.log(`Role "${roleName}" assigned to user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to assign role ${roleName}:`, error.message);
    }
  }

  /**
   * Send a verification email to the user.
   * Keycloak sends an email with a link to verify their email address.
   */
  async sendVerifyEmail(userId: string) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      await this.adminClient.users.sendVerifyEmail({
        realm: this.realm,
        id: userId,
      });
      this.logger.log(`Verification email sent to user ${userId}`);
    } catch (error: any) {
      this.logger.error('Failed to send verification email:', error.message);
    }
  }

  /**
   * Send an email with required actions (e.g., update password, verify email).
   * This is used for invitation emails.
   * 
   * @param userId - Keycloak user ID
   * @param clientId - The client ID for redirect
   * @param redirectUri - Where to redirect after completing actions
   * @param lifespan - How long the link is valid (in seconds, default 7 days)
   */
  async sendInvitationEmail(
    userId: string,
    clientId: string,
    redirectUri: string,
    lifespan: number = 604800,
  ) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      await this.adminClient.users.executeActionsEmail({
        realm: this.realm,
        id: userId,
        clientId: clientId,
        redirectUri: redirectUri,
        actions: ['UPDATE_PASSWORD', 'VERIFY_EMAIL'],
        lifespan: lifespan,
      });

      this.logger.log(`Invitation email sent to user ${userId} (expires in ${lifespan / 86400} days)`);
    } catch (error: any) {
      this.logger.error('Failed to send invitation email:', error.message);
    }
  }

  /**
   * Delete a user from Keycloak.
   */
  async deleteUser(userId: string) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      await this.adminClient.users.del({
        realm: this.realm,
        id: userId,
      });
      this.logger.log(`User ${userId} deleted from Keycloak`);
    } catch (error: any) {
      this.logger.error('Failed to delete user:', error.message);
    }
  }

  /**
   * Get user by ID.
   */
  async getUser(userId: string) {
    const authed = await this.ensureAuth();
    if (!authed) return null;
    return this.adminClient.users.findOne({
      realm: this.realm,
      id: userId,
    });
  }

  /**
   * Get user by email.
   */
  async getUserByEmail(email: string) {
    const authed = await this.ensureAuth();
    if (!authed) return null;
    const users = await this.adminClient.users.find({
      realm: this.realm,
      email: email,
      exact: true,
    });
    return users[0] || null;
  }

  /**
   * Get user by username.
   */
  async getUserByUsername(username: string) {
    const authed = await this.ensureAuth();
    if (!authed) return null;
    const users = await this.adminClient.users.find({
      realm: this.realm,
      username: username,
      exact: true,
    });
    return users[0] || null;
  }

  /**
   * Validate user credentials by attempting a Resource Owner Password Grant.
   * Returns the tokens if credentials are valid, null otherwise.
   */
  async validateCredentials(
    username: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const keycloakUrl = this.config.get<string>('KEYCLOAK_URL', 'http://localhost:8080');
    const clientId = this.config.get<string>('KEYCLOAK_CLIENT_ID', 'frontend');
    const clientSecret = this.config.get<string>('KEYCLOAK_CLIENT_SECRET', '');

    try {
      const body = new URLSearchParams({
        grant_type: 'password',
        client_id: clientId,
        username,
        password,
      });

      if (clientSecret) {
        body.append('client_secret', clientSecret);
      }

      const response = await fetch(
        `${keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (error: any) {
      this.logger.error(`Credential validation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Reset a user's password (admin action).
   * Sets a new password directly via the Admin API.
   */
  async resetUserPassword(userId: string, newPassword: string) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      await this.adminClient.users.resetPassword({
        realm: this.realm,
        id: userId,
        credential: {
          type: 'password',
          value: newPassword,
          temporary: false,
        },
      });
      this.logger.log(`Password reset for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to reset password for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if a user has a specific attribute.
   */
  async getUserAttribute(userId: string, attributeName: string): Promise<string | null> {
    const authed = await this.ensureAuth();
    if (!authed) return null;

    try {
      const user = await this.adminClient.users.findOne({
        realm: this.realm,
        id: userId,
      });

      if (!user?.attributes?.[attributeName]) return null;
      const val = user.attributes[attributeName];
      return Array.isArray(val) ? val[0] : val;
    } catch {
      return null;
    }
  }

  /**
   * Set a user attribute.
   */
  async setUserAttribute(userId: string, attributeName: string, value: string) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      const user = await this.adminClient.users.findOne({
        realm: this.realm,
        id: userId,
      });

      if (!user) throw new Error('User not found');

      const attributes = user.attributes || {};
      attributes[attributeName] = [value];

      await this.adminClient.users.update(
        { realm: this.realm, id: userId },
        { ...user, attributes } as any,
      );
    } catch (error: any) {
      this.logger.error(`Failed to set attribute ${attributeName} for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove a user's required action.
   */
  async removeRequiredAction(userId: string, action: string) {
    const authed = await this.ensureAuth();
    if (!authed) return;

    try {
      const user = await this.adminClient.users.findOne({
        realm: this.realm,
        id: userId,
      });

      if (!user) return;

      const actions = (user.requiredActions || []).filter((a) => a !== action);

      await this.adminClient.users.update(
        { realm: this.realm, id: userId },
        { ...user, requiredActions: actions } as any,
      );
      this.logger.log(`Removed required action '${action}' for user ${userId}`);
    } catch (error: any) {
      this.logger.error(`Failed to remove required action for user ${userId}:`, error.message);
    }
  }
}