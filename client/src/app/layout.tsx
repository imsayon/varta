import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Montserrat } from 'next/font/google';
import { AuthProvider } from '@/shared/auth/auth-context';

import { Toaster } from 'sonner'
import '@/styles/variables.css';
import '@/styles/globals.css';

/**
 * Typography stack:
 *
 * --font-display  → Inter
 *   Direct, high-impact marketing display voice.
 *   Used for: launch page headlines, strong labels, and CTA moments.
 *
 * --font-body     → Montserrat
 *   Geometric, compact product UI voice.
 *   Used for: dashboard copy, forms, navigation, and controls.
 *
 * --font-mono     → JetBrains Mono
 *   Purpose-built for code and terminals.
 *   Used for: code blocks, event names, badges, technical tags, queue items.
 */

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--varta-ui',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--varta-display',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--varta-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Varta — Notification Infrastructure',
  description: 'Queue, route, fan-out, retry, and deliver across every channel. Self-hostable notification infrastructure.',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0a0908',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                fontSize: '13px',
              }
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
