'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button/Button';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
import type { INotification, NotificationStatus } from '@/shared/types/domain';

const statuses: Array<{ label: string; value: '' | NotificationStatus }> = [
  { label: 'All', value: '' },
  { label: 'Accepted', value: 'PENDING' },
  { label: 'Queued', value: 'ENQUEUED' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Failed', value: 'FAILED' },
];

export function NotificationLog() {
  const { workspace } = useAuth();
  const [items, setItems] = useState<INotification[]>([]);
  const [selected, setSelected] = useState<INotification | null>(null);
  const [status, setStatus] = useState<'' | NotificationStatus>('');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (append = false, nextCursor?: string | null) => {
    if (!workspace) return;
    setLoading(true);
    setError(null);
    const res = await apiClient.get<INotification[]>(`/api/v1/workspaces/${workspace.id}/notifications`, {
      params: { limit: 25, status: status || undefined, search: search || undefined, cursor: nextCursor || undefined },
    });
    if (res.success) {
      setItems((current) => append ? [...current, ...res.data.filter((item) => !current.some((existing) => existing.id === item.id))] : res.data);
      setCursor(typeof res.meta.cursor === 'string' ? res.meta.cursor : null);
    } else {
      setError(res.error.message);
      if (!append) setItems([]);
    }
    setLoading(false);
  }, [workspace, status, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openDetail = async (id: string) => {
    if (!workspace) return;
    const res = await apiClient.get<INotification>(`/api/v1/workspaces/${workspace.id}/notifications/${id}`);
    if (res.success) setSelected(res.data);
    else setError(res.error.message);
  };

  const resend = async (notification: INotification) => {
    if (!workspace || !window.confirm("Resend creates a new notification and consumes one run from your quota. Continue?")) return;
    const res = await apiClient.post(`/api/v1/workspaces/${workspace.id}/notifications/${notification.id}/retry`);
    if (res.success) await load();
    else setError(res.error.message);
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div><h1 className="dashboard-title">Notifications</h1><p className="dashboard-subtitle">Durably accepted notifications and their delivery outcomes. Resend creates a new notification and consumes quota.</p></div>
      </div>
      <div className="dashboard-toolbar">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {statuses.map((item) => <button key={item.label} type="button" className="dashboard-btn-secondary" aria-pressed={status === item.value} onClick={() => setStatus(item.value)}>{item.label}</button>)}
        </div>
        <label><span className="sr-only">Search notifications</span><input className="dashboard-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Template, subscriber, or idempotency key" /></label>
      </div>
      {error && <div role="alert" className="dashboard-error">{error}</div>}
      {loading && items.length === 0 ? <p>Loading notifications…</p> : items.length === 0 ? <p>No notifications match this view.</p> : (
        <div className="dashboard-table-card">
          <table className="dashboard-table">
            <thead><tr><th>Template</th><th>Subscriber</th><th>Channels</th><th>Status</th><th>Accepted</th><th>Action</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id}>
              <td>{item.template?.name || item.templateId}</td><td>{item.subscriber?.externalId || item.subscriberId}</td><td>{item.channels.join(', ')}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleString()}</td>
              <td><Button size="sm" variant="secondary" onClick={() => void openDetail(item.id)}>Details</Button>{item.status === 'FAILED' && <Button size="sm" onClick={() => void resend(item)}>Resend</Button>}</td>
            </tr>)}</tbody>
          </table>
          {cursor && <div style={{ padding: 16 }}><Button variant="secondary" loading={loading} onClick={() => void load(true, cursor)}>Load more</Button></div>}
        </div>
      )}
      {selected && <section aria-labelledby="notification-detail" className="dashboard-table-card" style={{ marginTop: 20, padding: 20 }}>
        <h2 id="notification-detail">Notification detail</h2>
        <p className="dashboard-mono">{selected.id}</p>
        <p>Status: {selected.status}; read: {selected.readAt ? new Date(selected.readAt).toLocaleString() : 'not marked read'}</p>
        <h3>Deliveries</h3>
        {(selected.deliveries || []).map((delivery) => <div key={delivery.id}><strong>{delivery.channel}</strong>: {delivery.status}{delivery.provider ? ` via ${delivery.provider}` : ''}{delivery.lastError ? ` — ${delivery.lastError}` : ''}</div>)}
        <h3>Attempts</h3>
        {(selected.deliveryAttempts || []).map((attempt) => <div key={attempt.id}>#{attempt.attemptNumber} {attempt.channel}: {attempt.status}{attempt.errorMessage ? ` — ${attempt.errorMessage}` : ''}</div>)}
        <Button variant="secondary" onClick={() => setSelected(null)}>Close detail</Button>
      </section>}
    </div>
  );
}
