import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import Header from '@/components/Header/Header';
import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';

import './globals.scss';

const playfair = Playfair_Display({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
});

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PolicyPilot \u2014 Ask your company handbook anything',
  description:
    'AI-powered employee policy assistant. Upload your company handbook and get instant, cited answers.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${playfair.variable} ${inter.variable}`}>
        <QueryProvider>
          <AuthProvider>
            <Header />
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
