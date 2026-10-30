'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import { CheckCircle2, XCircle, Loader2, ArrowRight, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

export default function VerifyEmailPage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : Array.isArray(params.token) ? params.token[0] : '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  const verifyToken = React.useCallback(async () => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Verification token is missing from the URL.');
      return;
    }

    try {
      setStatus('loading');
      await api.post(`/auth/verify-email/${token}`);
      setStatus('success');
      toast.success('Email verified successfully!');
    } catch (err: any) {
      setStatus('error');
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Invalid or expired email verification link.';
      setErrorMessage(msg);
    }
  }, [token]);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  // 3s countdown on success -> redirect /login
  useEffect(() => {
    if (status !== 'success') return;

    if (countdown <= 0) {
      router.push('/login');
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [status, countdown, router]);

  return (
    <div className="text-center py-4 space-y-5">
      {status === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/40 border border-primary-300 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 mx-auto flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-[var(--neo-text)]">
              Verifying Your Patron Email...
            </h2>
            <p className="text-xs sm:text-sm text-[var(--neo-text-2)]">
              Validating cryptographic token with City Library security service
            </p>
          </div>
        </motion.div>
      )}

      {status === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/40">
            <CheckCircle2 className="w-8 h-8 stroke-[2]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-bold text-[var(--neo-text)]">
              Email Verified Successfully!
            </h2>
            <p className="text-xs sm:text-sm text-[var(--neo-text-2)] max-w-sm mx-auto leading-relaxed">
              Your patron account is now fully activated with full lending privileges.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] text-xs text-[var(--neo-text-2)]">
            Redirecting to sign in portal in{' '}
            <strong className="text-[var(--neo-accent)] font-mono text-sm">{countdown}s</strong>...
          </div>

          <div className="pt-2">
            <Link href="/login" className="w-full">
              <Button variant="primary" size="md" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Go to Sign In Now
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/40">
            <XCircle className="w-8 h-8 stroke-[2]" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-[var(--neo-text)]">
              Verification Failed
            </h2>
            <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 max-w-sm mx-auto font-medium">
              {errorMessage || 'We could not verify your email address.'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] text-xs text-[var(--neo-text-2)] text-left space-y-1.5">
            <p>Verification links can expire after 24 hours or if already used.</p>
            <p>If you already confirmed, you can sign in directly.</p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="secondary"
              size="md"
              onClick={verifyToken}
              leftIcon={<RotateCcw className="w-4 h-4" />}
            >
              Retry Verification
            </Button>

            <Link href="/login" className="w-full">
              <Button variant="ghost" size="sm" className="w-full">
                Return to Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
