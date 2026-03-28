import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Analytics } from '@vercel/analytics/next';
import { AuthProvider } from '@/context/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';

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
    title: 'DocQA — Document Q&A with RAG',
    description: 'Upload documents, ask questions, get grounded answers with source citations.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable}`}>
                <QueryProvider>
                    <AuthProvider>{children}</AuthProvider>
                </QueryProvider>
                <Analytics />
            </body>
        </html>
    );
}
