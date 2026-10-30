import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // After OAuth completes, always land on our handler page
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      return `${baseUrl}/oauth-callback`;
    },
    async jwt({ token, account }) {
      // Persist provider and oauthId in JWT on first sign-in
      if (account) {
        token.provider = account.provider?.toUpperCase();
        token.oauthId = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose provider and oauthId to the client session
      if (session.user) {
        (session.user as any).provider = token.provider;
        (session.user as any).oauthId = token.oauthId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET ?? 'lms_nextauth_dev_fallback_secret_32_chars_pk',
};
