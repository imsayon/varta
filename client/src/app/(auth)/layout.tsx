import { IBM_Plex_Sans } from 'next/font/google';
import AuthLayoutClient from './AuthLayoutClient';

const authFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-auth',
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayoutClient fontClassName={authFont.variable}>
      {children}
    </AuthLayoutClient>
  );
}
