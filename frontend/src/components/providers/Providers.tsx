"use client";

import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { QueryErrorBoundary } from "@/components/providers/QueryErrorBoundary";
import { GlobalExperience } from "@/components/layout/GlobalExperience";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { NextAuthProvider } from "@/components/providers/NextAuthProvider";

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { user, accessToken, setUser } = useAuthStore();

  useEffect(() => {
    // On client mount, if we have a token, verify the current session.
    if (accessToken && user) {
      api
        .get("/auth/me")
        .then((res) => {
          const freshUser = res.data?.data || res.data;
          if (freshUser) setUser(freshUser);
        })
        .catch(() => {
          // The API interceptor handles expired sessions.
        });
    }
    // Session initialization runs once; subsequent updates belong to the auth store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}

function SocketSubscriber() {
  useSocketEvents();
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 10 * 60 * 1000,
          retry: (failureCount, error) => {
            // The interceptor owns rate-limit and service-unavailable retries.
            if (
              isAxiosError(error) &&
              error.response &&
              (error.response.status < 500 || error.response.status === 503)
            )
              return false;
            return failureCount < 2;
          },
          retryDelay: (attemptIndex) =>
            Math.min(1000 * 2 ** attemptIndex, 30000),
          refetchOnWindowFocus: false,
          // Retain usable cached content if only a background refresh fails.
          throwOnError: (_error, query) => query.state.data === undefined,
        },
      },
    });

    for (const key of ["books", "book", "search", "categories"]) {
      client.setQueryDefaults([key], {
        staleTime: 5 * 60 * 1000, 
        gcTime: 10 * 60 * 1000,
      });
    }
    for (const key of [
      "user",
      "users",
      "member",
      "members",
      "auth",
      "auth/me",
      "profile",
      "notifications",
      "fines",
      "circulation",
      "reservations",
    ]) {
      client.setQueryDefaults([key], { staleTime: 0, gcTime: 10 * 60 * 1000 });
    }
    return client;
  });

  return (
    <NextAuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthInitializer>
            <SocketSubscriber />
            <GlobalExperience />
            <QueryErrorBoundary>{children}</QueryErrorBoundary>
            <ToastProvider />
          </AuthInitializer>
        </QueryClientProvider>
      </ThemeProvider>
    </NextAuthProvider>
  );
}
