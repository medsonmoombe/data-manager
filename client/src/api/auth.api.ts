import api from './axios';

export interface SessionUser {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  orgId?: string;
  orgName?: string | null;
  realm_access?: { roles: string[] };
  required_actions?: string[];
}

export interface LoginSuccessResponse {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  emailVerified: boolean;
  enabled: boolean;
  requiredActions: string[];
  orgId: string;
  orgName: string | null;
  lastLogin: string | null;
}

export const authApi = {
  /**
   * Sign in. Credentials in, tokens out — there is no 2FA/OTP step.
   */
  login: async (username: string, password: string) => {
    const res = await api.post('/auth/api/login', { username, password }) as any;
    return res.data as LoginSuccessResponse;
  },

  /**
   * Exchange a refresh token for a new access token (the refresh token rotates).
   */
  refresh: async (refreshToken: string) => {
    const res = await api.post('/auth/api/refresh', { refreshToken }) as any;
    return res.data as LoginSuccessResponse;
  },

  /**
   * Revoke the current refresh token.
   */
  logout: async (refreshToken?: string) => {
    const res = await api.post('/auth/api/logout', { refreshToken }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Request a password reset email.
   */
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/api/forgot-password', { email }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Complete a password reset with a token.
   */
  resetPassword: async (token: string, newPassword: string, confirmPassword: string) => {
    const res = await api.post('/auth/api/reset-password', { token, newPassword, confirmPassword }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Verify an email address with the token from the verification email.
   */
  verifyEmail: async (token: string) => {
    const res = await api.post('/auth/api/verify-email', { token }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Re-send the verification email for the signed-in user.
   */
  resendVerification: async () => {
    const res = await api.post('/auth/api/resend-verification', {}) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Change the password of the signed-in user.
   */
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string, forceChange = false) => {
    const res = await api.post('/auth/api/change-password', { currentPassword, newPassword, confirmPassword, forceChange }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Get the current user profile with pending required actions.
   */
  getMe: async () => {
    const res = await api.get('/auth/api/me') as any;
    return res.data as UserProfile;
  },

  /**
   * Clear a required action.
   */
  clearAction: async (action: string) => {
    const res = await api.post('/auth/api/clear-action', { action }) as any;
    return res.data as { success: boolean };
  },
};
