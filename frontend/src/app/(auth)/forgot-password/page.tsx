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
    mutate(
      { email: data.email },
      {
        onSuccess: clearDraft,
        onSettled: () => {
          // Show success state regardless of email existence
          setSubmittedEmail(data.email);
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
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
          Reset Your Password
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">
          Enter your registered email address and we will dispatch recovery instructions
        </p>
      </div>

      {submittedEmail ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="space-y-4 text-center py-2"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-white">
              Recovery Instructions Dispatched
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              If an account with <strong className="text-white font-mono break-all">{submittedEmail}</strong> exists,
              we have sent a password reset link to it.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-400 text-left space-y-2">
            <p>
              Please check your spam or junk folder if the message does not arrive within a few minutes.
            </p>
            {isCooldownActive ? (
              <p className="text-amber-400 font-medium">
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
              placeholder="patron@citylibrary.org"
              required
              leftIcon={<Mail className="w-4 h-4 text-slate-400" />}
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

          <div className="text-center pt-3 border-t border-slate-800/80">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
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
