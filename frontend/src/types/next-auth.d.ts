/**
 * NextAuth type augmentation.
 * Extends the built-in Session and JWT interfaces to include
 * the OAuth provider name and provider-specific account ID.
 */
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** OAuth provider — e.g. 'GOOGLE' | 'FACEBOOK' */
      provider?: string;
      /** Provider-specific account ID (sub / user ID) */
      oauthId?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** OAuth provider — e.g. 'GOOGLE' | 'FACEBOOK' */
    provider?: string;
    /** Provider-specific account ID (sub / user ID) */
    oauthId?: string;
  }
}
