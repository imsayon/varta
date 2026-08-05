'use client';

import { useState } from 'react';
import { MoreHorizontal, Search } from 'lucide-react';

const rows = [
  { id: '1', event: 'user.signup', sub: 'usr_abc123', channel: 'Email', status: 'delivered', provider: 'Resend', time: '2m ago' },
  { id: '2', event: 'payment.failed', sub: 'usr_xyz789', channel: 'Push', status: 'failed', provider: 'FCM', time: '15m ago' },
  { id: '3', event: 'dunning.warning', sub: 'usr_xyz789', channel: 'Email', status: 'retrying', provider: 'Postmark', time: '1h ago' },
  { id: '4', event: 'password.reset', sub: 'usr_def456', channel: 'Email', status: 'delivered', provider: 'Resend', time: '2h ago' },
  { id: '5', event: 'order.shipped', sub: 'usr_ghi987', channel: 'SMS', status: 'queued', provider: 'Twilio', time: '3h ago' },
];

function statusColor(status: string) {
  if (status === 'delivered') return 'var(--color-green)';
  if (status === 'failed') return 'var(--color-primary-500)';
  if (status === 'retrying') return 'var(--color-amber)';
  return 'var(--text-muted)';
}

export function NotificationLog() {
  const [activeTab, setActiveTab] = useState('All');

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Notifications</h1>
          <p className="dashboard-subtitle">Inspect recent event deliveries and provider outcomes.</p>
        </div>
      </div>

      <div className="dashboard-toolbar">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['All', 'Delivered', 'Failed', 'Retrying'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="dashboard-btn-secondary"
              style={{
                borderColor: activeTab === tab ? 'rgba(255,107,53,0.35)' : 'var(--border-subtle)',
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: activeTab === tab ? 'rgba(192,57,43,0.1)' : 'rgba(255,255,255,0.02)',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <label style={{ position: 'relative', width: 300, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="dashboard-input dashboard-mono" style={{ paddingLeft: 38 }} placeholder="Search event or subscriber..." />
        </label>
      </div>

      <div className="dashboard-table-card">
        <table className="dashboard-table">
          <thead><tr><th>Event</th><th>Subscriber</th><th>Channel</th><th>Status</th><th>Provider</th><th>Time</th><th /></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="dashboard-mono" style={{ color: 'var(--text-primary)' }}>{row.event}</td>
                <td className="dashboard-mono">{row.sub}</td>
                <td><span className="dashboard-chip">{row.channel}</span></td>
                <td style={{ color: statusColor(row.status), textTransform: 'capitalize' }}>{row.status}</td>
                <td>{row.provider}</td>
                <td style={{ color: 'var(--text-muted)' }}>{row.time}</td>
                <td><button className="dashboard-icon-btn"><MoreHorizontal size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: 13 }}>Showing 1-5 of 142 events</div>
      </div>
    </div>
  );
}
