
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { Providers } from '@/components/providers/Providers';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'NextGen LMS - Modern Library Management System',
    template: '%s | NextGen LMS',
  },
  description:
    'High-performance community library catalog, real-time circulation desk, automated overdue notices, and AI book summaries.',
  applicationName: 'NextGen LMS',
  keywords: [
    'library management system',
    'catalog',
    'circulation',
    'book loans',
    'AI summaries',
    'reading',
  ],
  authors: [{ name: 'NextGen LMS Engineering Team' }],
  openGraph: {
    title: 'NextGen LMS - Modern Library Management System',
    description:
      'High-performance community library catalog, real-time circulation desk, automated overdue notices, and AI book summaries.',
    url: 'https://nextgen-lms.local',
    siteName: 'NextGen LMS',
    images: [
      {
        url: '/nextgen_lms.webp',
        width: 800,
        height: 800,
        alt: 'NextGen LMS - Modern Library Management System',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NextGen LMS - Modern Library Management System',
    description:
      'High-performance community library catalog, real-time circulation desk, automated overdue notices, and AI book summaries.',
    images: ['/nextgen_lms.webp'],
  },
  robots: {
    index: true,
    follow: true,
  },
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = saved === 'dark' || (!saved && prefersDark) || (saved === 'system' && prefersDark);
                  var root = document.documentElement;
                  if (isDark) {
                    root.classList.add('dark');
                    root.setAttribute('data-theme', 'dark');
                  } else {
                    root.classList.remove('dark');
                    root.setAttribute('data-theme', 'light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-text)] font-sans antialiased overflow-x-hidden selection:bg-[var(--neo-accent)]/25 selection:text-[var(--neo-accent)] transition-colors duration-200"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
