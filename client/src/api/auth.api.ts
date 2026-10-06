import api from './axios';

export interface LoginResponse {
  requires2FA: true;
  sessionId: string;
  email: string;
}

export interface LoginSuccessResponse {
  requires2FA: false;
  accessToken: string;
  refreshToken: string;
  user: {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
    preferred_username?: string;
    realm_access?: { roles: string[] };
    required_actions?: string[];
  };
}

export interface TwoFactorResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    sub: string;
    email: string;
    given_name?: string;
    family_name?: string;
    preferred_username?: string;
    realm_access?: { roles: string[] };
    required_actions?: string[];
  };
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
  orgName: string;
  otpEnabled: boolean;
  lastLogin: number;
}

export const authApi = {
  /**
   * Login with username/password.
   * Returns tokens directly or requires 2FA.
   */
  login: async (username: string, password: string) => {
    const res = await api.post('/auth/api/login', { username, password }) as any;
    return res.data as LoginResponse | LoginSuccessResponse;
  },

  /**
   * Verify 2FA code and complete login.
   */
  verify2FA: async (sessionId: string, code: string) => {
    const res = await api.post('/auth/api/2fa/verify', { sessionId, code }) as any;
    return res.data as TwoFactorResponse;
  },

  /**
   * Resend 2FA OTP code.
   */
  resend2FA: async (sessionId: string, email: string) => {
    const res = await api.post('/auth/api/2fa/resend', { sessionId, email }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Request password reset email.
   */
  forgotPassword: async (email: string) => {
    const res = await api.post('/auth/api/forgot-password', { email }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Complete password reset with token.
   */
  resetPassword: async (token: string, newPassword: string, confirmPassword: string) => {
    const res = await api.post('/auth/api/reset-password', { token, newPassword, confirmPassword }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Change password for authenticated user.
   */
  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string, forceChange = false) => {
    const res = await api.post('/auth/api/change-password', { currentPassword, newPassword, confirmPassword, forceChange }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Get current user profile with required actions.
   */
  getMe: async () => {
    const res = await api.get('/auth/api/me') as any;
    return res.data as UserProfile;
  },

  /**
   * Enable or disable 2FA.
   */
  toggle2FA: async (enabled: boolean) => {
    const res = await api.post('/auth/api/2fa/toggle', { enabled }) as any;
    return res.data as { success: boolean; message: string };
  },

  /**
   * Clear a required action.
   */
  clearAction: async (action: string) => {
    const res = await api.post('/auth/api/clear-action', { action }) as any;
    return res.data as { success: boolean };
  },
};
