import { Edit2, Search } from 'lucide-react';

const subscribers = [
  { id: 'usr_abc123', email: 'alice@example.com', name: 'Alice Smith', status: 'active', date: '2026-10-24' },
  { id: 'usr_def456', email: 'bob@example.com', name: 'Bob Jones', status: 'active', date: '2026-10-22' },
  { id: 'usr_ghi789', email: 'charlie@example.com', name: 'Charlie Brown', status: 'inactive', date: '2026-09-15' },
  { id: 'usr_jkl012', email: 'diana@example.com', name: 'Diana Prince', status: 'active', date: '2026-08-30' },
  { id: 'usr_mno345', email: 'eve@example.com', name: 'Eve Adams', status: 'active', date: '2026-08-01' },
];

export function SubscriberList() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            Subscribers
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', padding: '2px 12px', background: 'var(--surface-3)', borderRadius: 'var(--radius-full)', color: 'var(--color-orange)', marginLeft: '10px', verticalAlign: 'middle', display: 'inline-block' }}>1,247</span>
          </h1>
          <p className="dashboard-subtitle">Profiles available for targeting, delivery preferences, and workflow triggers.</p>
        </div>
        <label style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="dashboard-input" style={{ paddingLeft: 38 }} placeholder="Search by ID or email..." />
        </label>
      </div>

      <div className="dashboard-table-card">
        <table className="dashboard-table">
          <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Status</th><th>Subscribed</th><th /></tr></thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td className="dashboard-mono" style={{ color: 'var(--text-primary)' }}>{subscriber.id}</td>
                <td>{subscriber.email}</td>
                <td style={{ color: 'var(--text-primary)' }}>{subscriber.name}</td>
                <td style={{ color: subscriber.status === 'active' ? 'var(--color-green)' : 'var(--text-muted)', textTransform: 'capitalize' }}>{subscriber.status}</td>
                <td style={{ color: 'var(--text-muted)' }}>{subscriber.date}</td>
                <td><button className="dashboard-btn-secondary" style={{ padding: '7px 10px' }}><Edit2 size={12} /> Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
