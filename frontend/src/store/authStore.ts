import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';
import { UserRole, MembershipType } from '@/lib/tokens';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  source?: 'LOCAL' | 'GOOGLE' | 'FACEBOOK';
  SOURCE?: 'LOCAL' | 'GOOGLE' | 'FACEBOOK';
  membershipType?: MembershipType;
  institution?: string;
  department?: string;
  studentId?: string;
  interests?: string[];
  avatar?: string;
  phone?: string;
  memberId?: string;
  maxBorrowLimit?: number;
  isEmailVerified?: boolean;
  isStaffApproved?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshTokenString: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (credentials: {
    email: string;
    password?: string;
    user?: User;
    accessToken?: string;
    refreshToken?: string;
  }) => Promise<{ success: boolean; user?: User; error?: string }>;
  oauthLogin: (data: {
    provider: 'GOOGLE' | 'FACEBOOK';
    email: string;
    name?: string;
    avatar?: string;
    oauthId?: string;
  }) => Promise<{
    success: boolean;
    requiresOnboarding?: boolean;
    sessionId?: string;
    profile?: any;
    user?: User;
    error?: string;
  }>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  updateProfile: (updatedData: Partial<User>) => Promise<void>;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
const secureSuffix = isProduction ? '; Secure' : '';

/** Access token cookie: 15-minute expiry matches JWT access token lifetime */
const setAuthCookies = (token: string, role: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = `auth_token=${token}; path=/; max-age=900; SameSite=Strict${secureSuffix}`;
    document.cookie = `auth_role=${role}; path=/; max-age=2592000; SameSite=Strict${secureSuffix}`;
  }
};

const clearAuthCookies = () => {
  if (typeof document !== 'undefined') {
    document.cookie = `auth_token=; path=/; max-age=0; SameSite=Strict${secureSuffix}`;
    document.cookie = `auth_role=; path=/; max-age=0; SameSite=Strict${secureSuffix}`;
  }
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshTokenString: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => {
        set({ user, isAuthenticated: !!user });
        if (user && get().accessToken) {
          setAuthCookies(get().accessToken!, user.role);
        }
      },

      setAccessToken: (accessToken) => {
        set({ accessToken, isAuthenticated: !!accessToken });
        if (accessToken && get().user) {
          setAuthCookies(accessToken, get().user!.role);
        }
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          // If direct payload passed (e.g. mock or pre-authenticated)
          if (credentials.user && credentials.accessToken) {
            setAuthCookies(credentials.accessToken, credentials.user.role);
            set({
              user: credentials.user,
              accessToken: credentials.accessToken,
              refreshTokenString: credentials.refreshToken || null,
              isAuthenticated: true,
              isLoading: false,
            });
            return { success: true, user: credentials.user };
          }

          // Real backend login call
          const response = await axios.post(`${API_BASE}/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          const data = response.data?.data || response.data;
          const user = data.user;
          const accessToken = data.accessToken || data.tokens?.accessToken;
          const refreshTokenString = data.refreshToken || data.tokens?.refreshToken;

          if (accessToken && user) {
            setAuthCookies(accessToken, user.role);
          }

          set({
            user,
            accessToken,
            refreshTokenString,
            isAuthenticated: true,
            isLoading: false,
          });

          return { success: true, user };
        } catch (error: any) {
          set({ isLoading: false });
          const message = error.response?.data?.message || error.message || 'Login failed';
          return { success: false, error: message };
        }
      },

      oauthLogin: async (data) => {
        set({ isLoading: true });
        try {
          const response = await axios.post(`${API_BASE}/auth/oauth`, data);
          const resData = response.data?.data || response.data;

          if (resData.requiresOnboarding) {
            set({ isLoading: false });
            return {
              success: true,
              requiresOnboarding: true,
              sessionId: resData.sessionId,
              profile: resData.profile,
            };
          }

          const user = resData.user;
          const accessToken = resData.accessToken || resData.tokens?.accessToken;
          const refreshTokenString = resData.refreshToken || resData.tokens?.refreshToken;

          if (accessToken && user) {
            setAuthCookies(accessToken, user.role);
          }

          set({
            user,
            accessToken,
            refreshTokenString,
            isAuthenticated: true,
            isLoading: false,
          });

          return { success: true, requiresOnboarding: false, user };
        } catch (error: any) {
          set({ isLoading: false });
          const message = error.response?.data?.message || error.message || 'Third-party sign-in failed.';
          return { success: false, error: message };
        }
      },

      logout: async () => {
        const { accessToken } = get();
        try {
          if (accessToken) {
            await axios
              .post(
                `${API_BASE}/auth/logout`,
                {},
                {
                  headers: {
                    Authorization: `Bearer ${accessToken}`,
                  },
                }
              )
              .catch(() => {});
          }
        } finally {
          clearAuthCookies();
          set({
            user: null,
            accessToken: null,
            refreshTokenString: null,
            isAuthenticated: false,
            isLoading: false,
          });
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth-storage');
          }
        }
      },

      refreshToken: async () => {
        const { refreshTokenString } = get();
        try {
          const response = await axios.post(
            `${API_BASE}/auth/refresh-token`,
            { refreshToken: refreshTokenString },
            { withCredentials: true }
          );

          const data = response.data?.data || response.data;
          const newAccessToken = data.accessToken || data.tokens?.accessToken;
          const newRefreshToken = data.refreshToken || data.tokens?.refreshToken || refreshTokenString;

          if (newAccessToken) {
            const currentUser = get().user;
            if (currentUser) {
              setAuthCookies(newAccessToken, currentUser.role);
            }
            set({
              accessToken: newAccessToken,
              refreshTokenString: newRefreshToken,
              isAuthenticated: true,
            });
            return newAccessToken;
          }
          return null;
        } catch (error) {
          clearAuthCookies();
          set({
            user: null,
            accessToken: null,
            refreshTokenString: null,
            isAuthenticated: false,
          });
          return null;
        }
      },

      updateProfile: async (updatedData: Partial<User>) => {
        const currentUser = get().user;
        if (!currentUser) return;

        const updated = {
          ...currentUser,
          ...updatedData,
        };
        set({ user: updated });
        if (get().accessToken) {
          setAuthCookies(get().accessToken!, updated.role);
        }
      },
    }),
    {
      name: 'lms-auth-storage',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined'
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshTokenString: state.refreshTokenString,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
