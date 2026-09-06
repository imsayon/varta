'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-context';
import styles from './AuthLayout.module.css';

export default function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode;
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
