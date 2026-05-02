import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Translator',
  description: "Tell us in your own words. We'll write something clear back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`}>
        <body style={{ margin: 0, background: 'var(--tx-bg)', height: '100%' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
