import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  sub: string;
  email: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  roles?: string[];
  realm_access?: { roles: string[] };
  required_actions?: string[];
  orgId?: string;
  orgName?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  orgId: string | null;
  orgName: string | null;
  isAuthenticated: boolean;
  
  setAuth: (token: string, refreshToken: string, user: User) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setOrgId: (orgId: string) => void;
  setOrgName: (orgName: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      orgId: null,
      orgName: null,
      isAuthenticated: false,

      setAuth: (token, refreshToken, user) =>
        set({
          token,
          refreshToken,
          user,
          isAuthenticated: true,
          orgId: user.orgId || null,
          orgName: user.orgName || null,
        }),

      // Used by the axios refresh interceptor to rotate tokens in place.
      setTokens: (token, refreshToken) => set({ token, refreshToken }),

      setOrgId: (orgId) => set({ orgId }),
      setOrgName: (orgName) => set({ orgName }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: () =>
        set({
          token: null,
          refreshToken: null,
          user: null,
          orgId: null,
          orgName: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'omnicore-auth',
    },
  ),
);