'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signIn } from 'next-auth/react';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid academic or patron email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [isOauthLoading, setIsOauthLoading] = useState<'google' | 'facebook' | null>(null);

  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { clearDraft } = useFormDraft({
    formId: 'login',
    anonymous: true,
    label: 'Sign in email',
    fields: ['email'],
    watch,
    reset,
    getValues,
  });

  const onSubmit = (data: LoginFormData) => {
    setOauthError(null);
    loginMutation.mutate(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: clearDraft,
      }
    );
  };

  const handleOAuthSignIn = async (provider: 'GOOGLE' | 'FACEBOOK') => {
    setIsOauthLoading(provider.toLowerCase() as 'google' | 'facebook');
    setOauthError(null);

    try {
      // Trigger real NextAuth OAuth flow; NextAuth will redirect back to /oauth-callback
      await signIn(provider.toLowerCase(), {
        callbackUrl: '/oauth-callback',
        redirect: true,
      });
      // signIn with redirect:true navigates away; code below only runs on error
    } catch (err: any) {
      setOauthError(err.message || 'An unexpected error occurred during sign in.');
      setIsOauthLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
          Sign In to Your Account
        </h2>
        <p className="text-xs sm:text-sm text-[var(--neo-text-2)]">
          Access your catalog circulation, active loans, and academic book reservations
        </p>
      </div>

      {oauthError && (
        <div className="p-3 rounded-[var(--neo-r-sm)] bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{oauthError}</span>
        </div>
      )}

      {/* Third-Party Authentication Providers */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => handleOAuthSignIn('GOOGLE')}
          disabled={isOauthLoading !== null || loginMutation.isPending}
          className="w-full h-11 px-4 rounded-[var(--neo-r-md)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] hover:bg-[var(--neo-surface)] text-[var(--neo-text)] font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-3 [box-shadow:var(--neo-raised-sm)] active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>
            {isOauthLoading === 'google' ? 'Connecting to Google...' : 'Continue with Google'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleOAuthSignIn('FACEBOOK')}
          disabled={isOauthLoading !== null || loginMutation.isPending}
          className="w-full h-11 px-4 rounded-[var(--neo-r-md)] border border-[#1877F2]/30 bg-[#1877F2]/10 hover:bg-[#1877F2]/20 text-[#1877F2] dark:text-[#4294ff] font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-3 [box-shadow:var(--neo-raised-sm)] active:translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
        >
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>
            {isOauthLoading === 'facebook' ? 'Connecting to Facebook...' : 'Continue with Facebook'}
          </span>
        </button>
      </div>

      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]" />
        </div>
        <span className="relative bg-[var(--neo-card)] px-3 text-[11px] uppercase tracking-wider font-semibold text-[var(--neo-text-3)]">
          Or sign in with email
        </span>
      </div>

      {/* Main Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            label="Email Address"
            type="email"
            placeholder="ali.khan@nust.edu.pk"
            required
            leftIcon={<Mail className="w-4 h-4 text-[var(--neo-text-3)]" />}
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] flex items-center gap-1 select-none">
              Password <span className="text-[var(--neo-danger)] font-bold">*</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[var(--neo-accent)] hover:underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••••••"
              leftIcon={<Lock className="w-4 h-4 text-[var(--neo-text-3)]" />}
              error={errors.password?.message}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-[var(--neo-text-3)] hover:text-[var(--neo-text)] transition-colors focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              {...register('password')}
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loginMutation.isPending}
          leftIcon={<LogIn className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Sign In
        </Button>
      </form>

      <div className="text-center pt-4 border-t border-[var(--neo-shadow-dark)]/25 text-xs text-[var(--neo-text-3)]">
        New patron in the community?{' '}
        <Link href="/register" className="font-bold text-[var(--neo-accent)] hover:underline ml-1">
          Register for a library card
        </Link>
      </div>
    </div>
  );
}
