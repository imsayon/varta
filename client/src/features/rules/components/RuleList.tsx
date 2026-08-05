import { ArrowRight, Edit2, Plus, Trash2 } from 'lucide-react';

const rules = [
  { id: '1', name: 'dunning-v2', event: 'user.payment_failed', conditions: ['plan === pro', 'trial < 3d'], channels: ['Push', 'Email', 'SMS'], status: 'Active', priority: 'High' },
  { id: '2', name: 'welcome-flow', event: 'user.signup', conditions: [], channels: ['Email'], status: 'Active', priority: 'Medium' },
  { id: '3', name: 'weekly-digest', event: 'system.digest', conditions: ['opt_in === true'], channels: ['Email'], status: 'Draft', priority: 'Low' },
];

export function RuleList() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Routing Rules</h1>
          <p className="dashboard-subtitle">Priority ordered rules that choose delivery channels and fallback paths.</p>
        </div>
        <button className="dashboard-btn-primary"><Plus size={16} /> New Rule</button>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {rules.map((rule) => (
          <section key={rule.id} className="dashboard-card" style={{ padding: 22, display: 'grid', gap: 20 }}>
            <div className="dashboard-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className="dashboard-chip" style={{ color: 'var(--color-primary-400)', background: 'rgba(192,57,43,0.1)' }}>{rule.name}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Event: <span className="dashboard-mono" style={{ color: 'var(--text-primary)' }}>{rule.event}</span></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="dashboard-chip" style={{ color: rule.status === 'Active' ? 'var(--color-green)' : 'var(--color-amber)' }}>{rule.status}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Priority: {rule.priority}</span>
                <button className="dashboard-icon-btn"><Edit2 size={15} /></button>
                <button className="dashboard-icon-btn" style={{ color: 'var(--color-primary-500)' }}><Trash2 size={15} /></button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
              <div>
                <div className="dashboard-label" style={{ marginBottom: 9 }}>Conditions</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rule.conditions.length ? rule.conditions.map((condition) => (
                    <span key={condition} className="dashboard-chip dashboard-mono">{condition}</span>
                  )) : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Always evaluate</span>}
                </div>
              </div>
              <div>
                <div className="dashboard-label" style={{ marginBottom: 9 }}>Channel flow</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {rule.channels.map((channel, index) => (
                    <span key={channel} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span className="dashboard-chip">{channel}</span>
                      {index < rule.channels.length - 1 && <ArrowRight size={14} color="var(--text-muted)" />}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
