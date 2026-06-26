import type { Metadata } from 'next';
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/shared/auth/auth-context';

import { Toaster } from 'sonner';
import '@/styles/variables.css';
import '@/styles/globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
  title: 'Varta — Multi-Channel Notification Infrastructure',
  description: 'Self-hostable notification infrastructure with AI delivery intelligence.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable}`}>
      <body>
        <AuthProvider>
          {children}
          <Toaster 
            theme="dark" 
            position="top-right" 
            toastOptions={{
              style: {
                background: 'rgba(15, 20, 35, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f1f5f9',
                backdropFilter: 'blur(16px)',
              }
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
