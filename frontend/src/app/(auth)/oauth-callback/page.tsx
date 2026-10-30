'use client';

import React, { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2, ShieldCheck } from 'lucide-react';

/**
 * OAuth Callback Handler
 *
 * After NextAuth resolves the provider session (Google / Facebook), the user
 * is redirected here.  We read the NextAuth session, call our backend
 * /api/v1/auth/oauth with the real provider data, and then:
 *  - requiresOnboarding: true  → /register?sessionId=…&step=2&source=GOOGLE
 *  - requiresOnboarding: false → /dashboard
 */
export default function OAuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { oauthLogin } = useAuthStore();
  const calledRef = useRef(false); // guard against double-effect in Strict Mode

  useEffect(() => {
    // Wait until NextAuth has resolved the session
    if (status === 'loading') return;

    // If no session (e.g. user cancelled), go back to login
    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login?error=OAuthCancelled');
      return;
    }

    // Prevent duplicate calls
    if (calledRef.current) return;
    calledRef.current = true;

    const user = session.user as {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string;
      oauthId?: string;
    };

    const provider = (user.provider ?? 'GOOGLE') as 'GOOGLE' | 'FACEBOOK';

    (async () => {
      const res = await oauthLogin({
        provider,
        email: user.email ?? '',
        name: user.name ?? '',
        avatar: user.image ?? undefined,
        oauthId: user.oauthId ?? '',
      });

      if (!res.success) {
        // Encode the error and send back to login
        router.replace(
          `/login?error=OAuthBackendError&message=${encodeURIComponent(
            res.error ?? 'Authentication failed. Please try again.'
          )}`
        );
        return;
      }

      if (res.requiresOnboarding && res.sessionId) {
        // New user — continue onboarding
        router.replace(
          `/register?sessionId=${res.sessionId}&step=2&source=${provider}`
        );
      } else {
        // Existing user — go straight to dashboard
        router.replace('/dashboard');
      }
    })();
  }, [status, session, router, oauthLogin]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6 py-12">
      <div className="w-16 h-16 rounded-2xl bg-[var(--neo-accent)]/10 border border-[var(--neo-accent)]/25 flex items-center justify-center text-[var(--neo-accent)]">
        <ShieldCheck className="w-8 h-8 stroke-[1.5]" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="font-display text-xl font-bold text-[var(--neo-text)]">
          Verifying your account…
        </h2>
        <p className="text-xs text-[var(--neo-text-2)] max-w-xs mx-auto leading-relaxed">
          Securely connecting your identity. You will be redirected in a moment.
        </p>
      </div>

      <Loader2 className="w-6 h-6 animate-spin text-[var(--neo-accent)]" />
    </div>
  );
}
