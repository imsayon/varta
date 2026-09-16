'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-context';
import { Sidebar } from '@/components/layout/Sidebar/Sidebar';
import { Header } from '@/components/layout/Header/Header';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { SignalRail, SignalScene } from '@/components/motion/SignalMotion';
import styles from './DashboardLayout.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className={styles.loadingShell}>
        <div className={styles.loadingSidebar}>
          <Skeleton height={40} className="mb-6" />
          <Skeleton height={20} className="mb-4" />
          <Skeleton height={20} className="mb-4" />
          <Skeleton height={20} className="mb-4" />
        </div>
        <div className={styles.loadingMain}>
          <Skeleton height={60} className="mb-8" />
          <Skeleton height={200} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.shell}>
      <Sidebar mobileOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} />

      <div className={styles.mainWrap}>
        <Header onOpenMenu={() => setIsMobileNavOpen(true)} />

        <main className={styles.main}>
          <SignalRail compact label="ROUTE GRAPH // LIVE" />
          <SignalScene>{children}</SignalScene>
        </main>
      </div>
    </div>
  );
}
