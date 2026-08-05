import { Edit2, Eye, Plus } from 'lucide-react';

const templates = [
  { id: '1', name: 'Payment Failed Alert', channels: ['Email', 'Push'], date: 'Oct 24, 2026', code: '<h1>Payment Failed</h1>\n<p>Hi {{user.name}}, your payment failed.</p>' },
  { id: '2', name: 'Welcome Onboarding', channels: ['Email'], date: 'Oct 20, 2026', code: '<h1>Welcome to Varta</h1>\n<p>Ship your first notification.</p>' },
  { id: '3', name: 'Password Reset', channels: ['Email', 'SMS'], date: 'Sep 15, 2026', code: 'Your reset code is: {{code}}\nExpires in 15 minutes.' },
  { id: '4', name: 'Weekly Digest', channels: ['Email'], date: 'Sep 01, 2026', code: '<h2>Your Weekly Stats</h2>\n{{#each stats}}{{this}}{{/each}}' },
];

export function TemplateList() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Templates</h1>
          <p className="dashboard-subtitle">Reusable channel content for event-driven workflows.</p>
        </div>
        <button className="dashboard-btn-primary"><Plus size={16} /> New Template</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 18 }}>
        {templates.map((template) => (
          <section key={template.id} className="dashboard-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{template.name}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="dashboard-icon-btn"><Eye size={15} /></button>
                <button className="dashboard-icon-btn"><Edit2 size={15} /></button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {template.channels.map((channel) => <span key={channel} className="dashboard-chip">{channel}</span>)}
            </div>
            <pre className="dashboard-mono" style={{ margin: 0, flex: 1, minHeight: 120, overflow: 'hidden', whiteSpace: 'pre-wrap', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.6 }}>{template.code}</pre>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Last updated: {template.date}</span>
          </section>
        ))}
      </div>
    </div>
  );
}
