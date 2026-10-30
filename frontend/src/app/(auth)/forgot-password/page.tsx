'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Mail, ArrowLeft, Send, CheckCircle2, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useForgotPassword } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { mutate, isPending, cooldown, isCooldownActive } = useForgotPassword();

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const { clearDraft } = useFormDraft({
    formId: 'forgot-password', anonymous: true, label: 'Recovery email', fields: ['email'],
    watch, reset, getValues,
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    setErrorMessage(null);
    mutate(
      { email: data.email },
      {
        onSuccess: () => {
          clearDraft();
          setSubmittedEmail(data.email);
        },
        onError: (err: any) => {
          const msg = err.response?.data?.message || err.message || 'No account found with this email address.';
          setErrorMessage(msg);
        },
      }
    );
  };

  const handleResend = () => {
    const email = submittedEmail || getValues('email');
    if (email && !isCooldownActive) {
      mutate({ email }, { onSuccess: clearDraft });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
          Reset Your Password
        </h2>
        <p className="text-xs sm:text-sm text-[var(--neo-text-2)]">
          Enter your registered email address and we will dispatch recovery instructions
        </p>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-[var(--neo-r-sm)] bg-rose-500/10 border border-rose-500/25 text-xs text-rose-600 dark:text-rose-400">
          {errorMessage}
        </div>
      )}

      {submittedEmail ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="space-y-4 text-center py-2"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
              Recovery Instructions Dispatched
            </h3>
            <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
              If an account with <strong className="text-[var(--neo-text)] font-mono break-all">{submittedEmail}</strong> exists,
              we have sent a password reset link to it.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] text-xs text-[var(--neo-text-2)] text-left space-y-2">
            <p>
              Please check your spam or junk folder if the message does not arrive within a few minutes.
            </p>
            {isCooldownActive ? (
              <p className="text-amber-500 dark:text-amber-400 font-medium">
                You can request another link in <strong>{cooldown}s</strong>.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="secondary"
              size="md"
              disabled={isCooldownActive || isPending}
              onClick={handleResend}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              {isCooldownActive ? `Resend Available in ${cooldown}s` : 'Resend Reset Link'}
            </Button>

            <Link href="/login" className="w-full">
              <Button variant="ghost" size="sm" className="w-full" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input
              label="Email Address"
              type="email"
              placeholder="ali.khan@nust.edu.pk"
              required
              leftIcon={<Mail className="w-4 h-4 text-[var(--neo-text-muted)]" />}
              error={errors.email?.message}
              {...register('email')}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isPending}
            disabled={isCooldownActive}
            leftIcon={<Send className="w-4 h-4" />}
            className="w-full mt-2"
          >
            {isCooldownActive ? `Wait ${cooldown}s to Resend` : 'Send Reset Link'}
          </Button>

          <div className="text-center pt-3 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--neo-text-2)] hover:text-[var(--neo-text)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
