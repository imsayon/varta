'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
import { Card } from '@/components/ui/Card/Card';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { List, CheckCircle, Clock, XCircle, Loader } from 'lucide-react';
import type { INotification, INotificationListData } from '@/shared/types/domain';
import styles from './NotificationsPage.module.css';

export default function NotificationsPage() {
  const { workspace } = useAuth();
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace) return;

    void (async () => {
      setLoading(true);
      const res = await apiClient.get<INotificationListData>(`/api/v1/workspaces/${workspace.id}/notifications`);
      if (res.success && res.data) {
        setNotifications(res.data.notifications);
      }
      setLoading(false);
    })();
  }, [workspace]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'ENQUEUED': return <span className={`${styles.badge} ${styles.badgeEnqueued}`}><Clock size={12} className="mr-1"/> ENQUEUED</span>;
      case 'DELIVERED': return <span className={`${styles.badge} ${styles.badgeDelivered}`}><CheckCircle size={12} className="mr-1"/> DELIVERED</span>;
      case 'FAILED': return <span className={`${styles.badge} ${styles.badgeFailed}`}><XCircle size={12} className="mr-1"/> FAILED</span>;
      default: return <span className={`${styles.badge} ${styles.badgeDefault}`}>{status}</span>;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notification Logs</h1>
        <p className={styles.subtitle}>View delivery statuses and history of sent notifications</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4rem' }}>
          <Loader className="animate-spin text-primary-400" size={32} />
        </div>
      ) : notifications.length === 0 ? (
        <div className={styles.emptyContainer}>
          <EmptyState
            title="No Notifications"
            description="You haven't sent any notifications yet."
            icon={<List />}
          />
        </div>
      ) : (
        <Card className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>ID / Idempotency Key</th>
                  <th>Template</th>
                  <th>Subscriber</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id}>
                    <td>{getStatusBadge(n.status)}</td>
                    <td className={styles.monoId}>{n.idempotencyKey || n.id.slice(0,8)}</td>
                    <td>{n.template?.name || 'N/A'}</td>
                    <td>
                      <div>{n.subscriber?.name || 'Unknown'}</div>
                      <div className="text-sm text-secondary">{n.subscriber?.email}</div>
                    </td>
                    <td>{new Date(n.triggeredAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
