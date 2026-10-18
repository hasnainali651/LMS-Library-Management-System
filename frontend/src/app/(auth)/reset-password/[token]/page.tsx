'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrength } from '@/components/ui/PasswordStrength';
import { useResetPassword } from '@/hooks/useAuth';

const strongPasswordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_\-])[A-Za-z\d@$!%*?&#^_\-]{8,}$/;

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .regex(
        strongPasswordRegex,
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';
  const [showPassword, setShowPassword] = useState(false);
  const resetMutation = useResetPassword(token);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const watchedPassword = useWatch({ control, name: 'password' });

  const onSubmit = (data: ResetPasswordFormData) => {
    resetMutation.mutate({
      password: data.password,
      token,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
          Set New Password
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Create a secure new password for your City Library patron account
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Input
            label="New Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••••••"
            required
            leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrength password={watchedPassword} />
        </div>

        <div>
          <Input
            label="Confirm New Password"
            type="password"
            placeholder="••••••••••••"
            required
            leftIcon={<Lock className="w-4 h-4 text-slate-400" />}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={resetMutation.isPending}
          leftIcon={<KeyRound className="w-4 h-4" />}
          className="w-full mt-2"
        >
          Reset Password
        </Button>
      </form>

      <div className="text-center pt-3 border-t border-slate-800/80 text-xs text-slate-400">
        Remembered your password?{' '}
        <Link href="/login" className="font-semibold text-accent-400 hover:text-accent-300 hover:underline">
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}
