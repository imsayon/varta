'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-context';
import styles from './AuthLayout.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/analytics');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Background Mesh Gradients */}
      <div className={styles.meshBg} />
      <div className={styles.glowOrb1} />
      <div className={styles.glowOrb2} />

      <div className={styles.cardWrapper}>
        <div className={styles.brand}>
          <div className={styles.logoIcon}>V</div>
          <h1 className={styles.logoText}>Varta</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
