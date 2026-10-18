'use client';

import { useState, useEffect } from 'react';
import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuthStore, User } from '@/store/authStore';
import { UserRole } from '@/lib/tokens';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  membershipType?: string;
  studentId?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  password: string;
  token?: string;
}

export function getRoleRedirectPath(role?: UserRole | string): string {
  switch (role) {
    case 'admin':
      return '/dashboard/analytics';
    case 'librarian':
      return '/dashboard/circulation';
    case 'student':
    default:
      return '/dashboard';
  }
}

/**
 * useLogin Mutation
 * On success: store tokens, redirect by role (student->/dashboard, librarian->/dashboard/circulation, admin->/dashboard/analytics)
 */
export function useLogin() {
  const router = useRouter();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const result = await login(credentials);
      if (!result.success) {
        throw new Error(result.error || 'Invalid email or password');
      }
      return result;
    },
    onSuccess: (result) => {
      const user = result.user || useAuthStore.getState().user;
      const targetPath = getRoleRedirectPath(user?.role);
      toast.success('Signed in successfully');
      router.push(targetPath);
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Login failed';
      toast.error(message);
    },
  });
}

/**
 * useRegister Mutation
 * Calls POST /auth/register
 */
export function useRegister() {
  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const res = await api.post('/auth/register', payload);
      return res.data?.data || res.data;
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Registration failed';
      toast.error(message);
    },
  });
}

/**
 * useForgotPassword Mutation with 60s cooldown
 * On submit: shows success regardless of email existence. 60s resend countdown.
 */
export function useForgotPassword() {
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const mutation = useMutation({
    mutationFn: async ({ email }: ForgotPasswordPayload) => {
      if (cooldown > 0) {
        throw new Error(`Please wait ${cooldown} seconds before resending.`);
      }
      const res = await api.post('/auth/forgot-password', { email });
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      setCooldown(60);
      toast.success('Instructions have been sent if account exists');
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to dispatch reset email';
      toast.error(message);
    },
  });

  return {
    ...mutation,
    cooldown,
    isCooldownActive: cooldown > 0,
  };
}

/**
 * useResetPassword Mutation
 * Calls POST /auth/reset-password/:token
 * On success: redirect /login + toast "Password reset successfully"
 */
export function useResetPassword(token?: string) {
  const router = useRouter();

  return useMutation({
    mutationFn: async (payload: ResetPasswordPayload) => {
      const activeToken = payload.token || token;
      if (!activeToken) {
        throw new Error('Reset token is missing or expired');
      }
      const res = await api.post(`/auth/reset-password/${activeToken}`, {
        password: payload.password,
      });
      return res.data?.data || res.data;
    },
    onSuccess: () => {
      toast.success('Password reset successfully');
      router.push('/login');
    },
    onError: (err: any) => {
      const message = err.response?.data?.message || err.message || 'Failed to reset password';
      toast.error(message);
    },
  });
}
