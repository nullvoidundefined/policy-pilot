import DocBar from '@/components/DocBar/DocBar';
import { ErrorBoundary } from '@/components/ErrorBoundary/ErrorBoundary';
import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import './globals.scss';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PolicyPilot — Ask your company handbook anything',
  description:
    'AI-powered employee policy assistant. Upload your company handbook and get instant, cited answers.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <DocBar />
        <QueryProvider>
          <AuthProvider>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthProvider>
        </QueryProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
