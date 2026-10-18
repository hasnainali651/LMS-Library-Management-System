'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, Lock, Eye, EyeOff, Sparkles, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';
import { UserRole } from '@/lib/tokens';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'student@library.com',
      password: 'Student@123456',
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

  const handleRolePreset = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'admin') {
      setValue('email', 'admin@library.com');
      setValue('password', 'Admin@123456');
    } else if (role === 'librarian') {
      setValue('email', 'sarah.librarian@library.com');
      setValue('password', 'Librarian@123456');
    } else {
      setValue('email', 'student@library.com');
      setValue('password', 'Student@123456');
    }
  };

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(
      {
        email: data.email,
        password: data.password,
      },
      { onSuccess: clearDraft }
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
          Sign In to Your Account
        </h2>
        <p className="text-xs sm:text-sm text-[var(--neo-text-2)]">
          Enter your credentials to access catalog circulation and member perks
        </p>
      </div>

      {/* Tactile Demo Role Switcher */}
      <div className="neo-inset-well p-3 rounded-[var(--neo-r-md)] space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--neo-text-3)] uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-[var(--neo-accent)]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Select Demo Account</span>
          </span>
          <span className="text-[10px] font-normal">Auto-fills credentials</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['student', 'librarian', 'admin'] as UserRole[]).map((r) => {
            const isSelected = selectedRole === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => handleRolePreset(r)}
                className={`py-2 px-2.5 rounded-[var(--neo-r-sm)] text-xs font-bold capitalize transition-all select-none ${
                  isSelected
                    ? 'bg-[var(--neo-card)] text-[var(--neo-accent)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-border-light)]'
                    : 'text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)]/50'
                }`}
              >
                {r === 'student' ? 'Member' : r}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Input
            label="Email Address"
            type="email"
            placeholder="patron@library.com"
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
