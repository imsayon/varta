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
  const { workspace } = useAuth();
  return <WorkspaceHeader key={workspace?.id} onOpenMenu={onOpenMenu} />;
}

function WorkspaceHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { workspace, apiKey, getAbortSignal } = useAuth();
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [notifications, setNotifications] = useState<IWSNotification[]>([]);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [failedReadIds, setFailedReadIds] = useState<string[]>([]);
  const workspaceId = workspace?.id;

  const onRealtimeNotification = useCallback((payload: { id?: string; [key: string]: unknown }) => {
    if (!payload.id) return;
    const item: IWSNotification = {
      id: payload.id,
      title: typeof payload.title === 'string' ? payload.title : 'In-app notification',
      body: typeof payload.body === 'string' ? payload.body : 'A notification was accepted for this workspace.',
      timestamp: typeof payload.createdAt === 'string' ? payload.createdAt : new Date().toISOString(),
      readAt: null,
    };
    setNotifications((current) => [{ ...item, readAt: current.find((existing) => existing.id === item.id)?.readAt ?? null }, ...current.filter((existing) => existing.id !== item.id)].slice(0, 50));
  }, []);

  const { isConnected } = useWebSocket({ workspaceId: workspace?.id, onNotification: onRealtimeNotification });

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, getAbortSignal()]);
    const timer = window.setTimeout(() => {
      if (!workspaceId) return;
      void apiClient.get<INotification[]>(`/api/v1/workspaces/${workspaceId}/notifications`, { params: { limit: 50 }, signal }).then((res) => {
        if (!res.success || signal.aborted) return;
        setNotifications((current) => [
          ...current.filter((item) => !res.data.some((persisted) => persisted.id === item.id)),
          ...res.data.map((item) => ({
          id: item.id,
          title: item.template?.name || 'Notification',
          body: `${item.subscriber?.externalId || 'Subscriber'} · ${item.status.toLowerCase()}`,
          timestamp: item.createdAt,
          readAt: current.find((existing) => existing.id === item.id)?.readAt || item.readAt,
        }))].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()).slice(0, 50));
      });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [workspaceId, isConnected, getAbortSignal]);

  const markAllRead = async () => {
    if (!workspaceId || isMarkingRead) return;
    const signal = getAbortSignal();
    const unread = notifications.filter((item) => !item.readAt);
    setIsMarkingRead(true);
    setFailedReadIds([]);
    const results = await Promise.all(unread.map((item) => apiClient.patch(`/api/v1/workspaces/${workspaceId}/notifications/${item.id}/read`, undefined, { signal })));
    setIsMarkingRead(false);
    if (signal.aborted) return;
    const persistedIds = new Set(unread.filter((_, index) => results[index].success).map((item) => item.id));
    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) => persistedIds.has(item.id) ? { ...item, readAt: item.readAt || now } : item));
    setFailedReadIds(unread.filter((_, index) => !results[index].success).map((item) => item.id));
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const readError = notifications.some((item) => !item.readAt && failedReadIds.includes(item.id))
    ? 'Some notifications could not be marked as read. Unread badges have been kept. Try again.'
    : null;

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
      <NotificationSidebar isOpen={isFeedOpen} onClose={() => setIsFeedOpen(false)} notifications={notifications} isConnected={isConnected} onMarkAllRead={() => void markAllRead()} isMarkingRead={isMarkingRead} readError={readError} />
    </header>
  );
}
