import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Bricolage_Grotesque, Alumni_Sans } from 'next/font/google';
import { AuthProvider } from '@/shared/auth/auth-context';

import { Toaster } from 'sonner'
import '@/styles/variables.css';
import '@/styles/globals.css';

/**
 * Typography stack:
 *
 * --font-display  → Bricolage Grotesque
 *   Editorial, variable-weight, distinctively modern.
 *   Used for: hero h1, section headlines, CTA headline.
 *
 * --font-data     → Alumni Sans
 *   Tall condensed proportions — makes numbers feel architectural.
 *   Used for: stat values, pricing numbers, scale metrics, overlines/labels.
 *
 * --font-body     → Inter
 *   The gold standard for readable UI prose.
 *   Used for: body copy, nav links, buttons, descriptions.
 *
 * --font-mono     → JetBrains Mono
 *   Purpose-built for code and terminals.
 *   Used for: code blocks, event names, badges, technical tags, queue items.
 */

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const alumniSans = Alumni_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-data',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Varta — Notification Infrastructure',
  description: 'Queue, route, fan-out, retry, and deliver across every channel. Self-hostable notification infrastructure.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${alumniSans.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
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
