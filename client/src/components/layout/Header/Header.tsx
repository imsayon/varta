'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
import { useWebSocket } from '@/shared/realtime/websocket';
import type { INotification, IWSNotification } from '@/shared/types/domain';
import { NotificationSidebar } from '@/components/layout/NotificationSidebar/NotificationSidebar';
import styles from './Header.module.css';

export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { workspace, apiKey } = useAuth();
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [notifications, setNotifications] = useState<IWSNotification[]>([]);

  const onRealtimeNotification = useCallback((payload: { id?: string; [key: string]: unknown }) => {
    if (!payload.id) return;
    const item: IWSNotification = {
      id: payload.id,
      title: typeof payload.title === 'string' ? payload.title : 'In-app notification',
      body: typeof payload.body === 'string' ? payload.body : 'A notification was accepted for this workspace.',
      timestamp: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
      readAt: null,
    };
    setNotifications((current) => [item, ...current.filter((existing) => existing.id !== item.id)].slice(0, 50));
  }, []);

  const { isConnected } = useWebSocket({ workspaceId: workspace?.id, onNotification: onRealtimeNotification });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setNotifications([]);
      if (!workspace) return;
      void apiClient.get<INotification[]>(`/api/v1/workspaces/${workspace.id}/notifications`, { params: { limit: 50 } }).then((res) => {
        if (!res.success) return;
        setNotifications(res.data.map((item) => ({
          id: item.id,
          title: item.template?.name || 'Notification',
          body: `${item.subscriber?.externalId || 'Subscriber'} · ${item.status.toLowerCase()}`,
          timestamp: item.createdAt,
          readAt: item.readAt,
        })));
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [workspace]);

  const markAllRead = async () => {
    if (!workspace) return;
    const unread = notifications.filter((item) => !item.readAt);
    await Promise.all(unread.map((item) => apiClient.patch(`/api/v1/workspaces/${workspace.id}/notifications/${item.id}/read`)));
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt || now })));
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  // Get display title based on path
  const getTitle = () => {
    switch (pathname) {
      case '/analytics':
        return 'Analytics';
      case '/templates':
        return 'Templates';
      case '/rules':
        return 'Routing Rules';
      case '/workflows':
        return 'Workflows';
      case '/api-keys':
        return 'API Keys';
      case '/subscribers':
        return 'Subscribers';
      case '/studio':
        return 'Trigger Studio';
      case '/notifications':
        return 'Notifications';
      case '/settings':
        return 'Settings';
      default:
        return 'Varta';
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button type="button" className={styles.menuButton} aria-label="Open navigation" onClick={onOpenMenu}>
          <Menu size={20} />
        </button>
        <h2 className={styles.title}>{getTitle()}</h2>
        {workspace && (
          <span className={styles.workspaceIndicator}>
            {workspace.name}
          </span>
        )}
      </div>

      <div className={styles.right}>
        <span role="status" aria-live="polite" className={`${styles.statusBadge} ${isConnected ? styles.connected : styles.disconnected}`}>{isConnected ? 'Live' : 'Reconnecting'}</span>
        <button type="button" className={styles.bellButton} aria-label={`Notifications, ${unreadCount} unread`} onClick={() => setIsFeedOpen(true)}>
          <Bell size={18} />{unreadCount > 0 && <span className={styles.unreadBadge}>{Math.min(unreadCount, 99)}</span>}
        </button>
        {/* API Key Badge */}
        {apiKey ? (
          <div className={styles.apiKeyBadge}>
            <span className={styles.keyLabel}>API:</span>
            <span className={styles.keyValue}>varta_live_••••{apiKey.slice(-6)}</span>
          </div>
        ) : (
          <div className={`${styles.apiKeyBadge} ${styles.noKey}`}>
            <span>No API Key</span>
          </div>
        )}

      </div>
      <NotificationSidebar isOpen={isFeedOpen} onClose={() => setIsFeedOpen(false)} notifications={notifications} isConnected={isConnected} onMarkAllRead={() => void markAllRead()} />
    </header>
  );
}
