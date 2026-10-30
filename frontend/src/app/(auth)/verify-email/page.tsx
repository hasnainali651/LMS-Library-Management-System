'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

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
    <div className="space-y-6 text-center">
      {status === 'loading' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 py-8"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-100 dark:bg-primary-900/40 border border-primary-300 dark:border-primary-500/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
            Verifying Your Email
          </h2>
          <p className="text-xs sm:text-sm text-[var(--neo-text-2)] max-w-sm mx-auto">
            Please wait while we confirm your email address and activate your account...
          </p>
        </motion.div>
      )}

      {status === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4 py-4"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
              Email Verified Successfully!
            </h2>
            <p className="text-xs sm:text-sm text-[var(--neo-text-2)] max-w-sm mx-auto">
              Your account is now fully activated. Redirecting to login in{' '}
              <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{countdown}s</span>...
            </p>
          </div>
          <div className="pt-2">
            <Link href="/login">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
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
          className="space-y-4 py-4"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <XCircle className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
              Verification Failed
            </h2>
            <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 max-w-sm mx-auto font-medium">
              {errorMessage}
            </p>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login">
              <Button variant="primary" size="md">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-[var(--neo-text)] text-center py-8">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
