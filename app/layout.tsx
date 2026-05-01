import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Translator',
  description: 'Tell us in your own words. We\'ll help.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased" style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        {children}
      </body>
    </html>
  );
}
