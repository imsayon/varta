'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-context';
import { Sidebar } from '@/components/layout/Sidebar/Sidebar';
import { Header } from '@/components/layout/Header/Header';
import { NotificationSidebar } from '@/components/layout/NotificationSidebar/NotificationSidebar';
import { useWebSocket } from '@/shared/realtime/websocket';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, workspace } = useAuth();
  const router = useRouter();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Connect WebSocket using the user's ID so they can receive live admin alerts or test sends
  const { notifications, isConnected, unreadCount, markAllRead } = useWebSocket(
    user?.id || null
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', height: '100vh', background: 'var(--surface-base)' }}>
        <div style={{ width: 'var(--sidebar-width)', borderRight: '1px solid var(--border-subtle)', padding: '24px' }}>
          <Skeleton height={40} className="mb-6" />
          <Skeleton height={20} className="mb-4" />
          <Skeleton height={20} className="mb-4" />
          <Skeleton height={20} className="mb-4" />
        </div>
        <div style={{ flex: 1, padding: '40px' }}>
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
    <div style={{ minHeight: '100vh', background: 'var(--surface-base)' }}>
      {/* Sidebar fixed */}
      <Sidebar />

      {/* Main Wrapper */}
      <div 
        style={{ 
          marginLeft: 'var(--sidebar-width)', 
          paddingTop: 'var(--header-height)',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Header 
          unreadCount={unreadCount}
          isConnected={isConnected}
          onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
        />

        <main style={{ flex: 1, padding: 'var(--space-6) var(--space-8)' }}>
          {children}
        </main>
      </div>

      <NotificationSidebar 
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        isConnected={isConnected}
        onMarkAllRead={markAllRead}
      />
    </div>
  );
}
