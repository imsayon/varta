'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-context';
import styles from './AuthLayout.module.css';

export default function AuthLayoutClient({
  children,
  fontClassName,
}: {
  children: React.ReactNode;
  fontClassName: string;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/analytics');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={`${styles.loadingContainer} ${fontClassName}`}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className={`${styles.container} ${fontClassName}`}>
      <div className={styles.meshBg} />
      <div className={styles.glowOrb1} />
      <div className={styles.glowOrb2} />

      <div className={styles.cardWrapper}>
        <div className={styles.brand}>
          <div className={styles.logoWrap}>
            <Image src="/varta-logo.png" alt="Varta" width={32} height={32} />
          </div>
          <h1 className={styles.logoText}>
            Varta<span>.</span>
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}
