/* Production checklist:
 * Change default seeder passwords
 * Set NODE_ENV=production
 * JWT_SECRET → 64-char random string
 * Configure real SMTP credentials
 * Set GEMINI_API_KEY
 * CORS → production frontend URL only
 * MongoDB Atlas with IP whitelist
 * Redis AUTH password
 * HTTPS with valid SSL
 * Set up log rotation + monitoring
 */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

export const metadata: Metadata = {
  title: 'NextGen LMS - Modern Library Management System',
  description:
    'Production-ready Next.js 14 Library Management System powered by Node.js, Express, MongoDB, Redis, and Socket.io',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nonces require request-time rendering rather than cached static HTML.
  const headerList = await headers();
  headerList.get('x-nonce');

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-text)] font-sans antialiased selection:bg-[var(--neo-accent)]/25 selection:text-[var(--neo-accent)]"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
