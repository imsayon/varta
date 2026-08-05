'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { apiClient } from '@/shared/api/api';
import { useAuth } from '@/shared/auth/auth-context';

export function AnalyticsDashboard() {
  const { workspace } = useAuth();
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    setError(null);

    const [overviewRes, channelRes, timelineRes] = await Promise.all([
      apiClient.get<any>(`/api/v1/workspaces/${workspace.id}/analytics/overview?timeRange=${timeRange}`),
      apiClient.get<any[]>(`/api/v1/workspaces/${workspace.id}/analytics/channel-breakdown?timeRange=${timeRange}`),
      apiClient.get<any[]>(`/api/v1/workspaces/${workspace.id}/analytics/delivery-timeline?timeRange=${timeRange}`),
    ]);

    if (overviewRes.success && overviewRes.data) {
      setOverview(overviewRes.data);
    }
    if (channelRes.success && channelRes.data) {
      setChannels(channelRes.data);
    }
    if (timelineRes.success && timelineRes.data) {
      setTimeline(timelineRes.data);
    }
    if (!overviewRes.success) {
      setError(overviewRes.error?.message || 'Failed to load analytics data');
    }

    setLoading(false);
  }, [workspace, timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const totalSent = overview?.totalSent ?? 0;
  const deliveryRate = overview?.deliveryRate != null ? `${(overview.deliveryRate * 100).toFixed(1)}%` : '0%';
  const p99Latency = overview?.p99Latency != null ? `${overview.p99Latency}ms` : '0ms';
  const failures = overview?.failures ?? 0;

  const statCards = [
    { label: 'Total Sent', value: totalSent.toLocaleString(), icon: Activity, note: `${timeRange} activity` },
    { label: 'Delivery Rate', value: deliveryRate, icon: TrendingUp, note: 'Successful attempts' },
    { label: 'P99 Latency', value: p99Latency, icon: Clock, note: '99th percentile speed' },
    { label: 'Failures', value: failures.toLocaleString(), icon: AlertCircle, note: 'Failed/DLQ attempts' },
  ];

  return (
    <div className="dashboard-page" style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="dashboard-title" style={{ fontSize: '1.75rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Analytics Overview
          </h1>
          <p className="dashboard-subtitle" style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Live metrics across channel delivery, latency, and throughput.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', backgroundColor: '#1e293b', padding: '4px', borderRadius: '0.375rem', border: '1px solid #334155' }}>
          {['7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 12px',
                borderRadius: '0.25rem',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: timeRange === range ? '#3b82f6' : 'transparent',
                color: timeRange === range ? '#ffffff' : '#94a3b8',
                fontWeight: 500,
                fontSize: '0.875rem',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div style={{ padding: '1.5rem', backgroundColor: '#7f1d1d', borderRadius: '0.5rem', color: '#fecaca', marginBottom: '1.5rem' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {statCards.map((card) => (
          <div key={card.label} style={{ padding: '1.25rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <card.icon size={16} /> {card.label}
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.25rem' }}>
              {loading ? '...' : card.value}
            </div>
            <p style={{ color: '#64748b', fontSize: '0.75rem', margin: 0 }}>{card.note}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div style={{ padding: '1.25rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>
            Channel Breakdown
          </h3>
          {loading ? (
            <p style={{ color: '#94a3b8' }}>Loading breakdown...</p>
          ) : channels.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No delivery data available for this range.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {channels.map((ch: any) => {
                const total = channels.reduce((acc, curr) => acc + (curr.count || 0), 0);
                const pct = total > 0 ? ((ch.count / total) * 100).toFixed(1) : 0;
                return (
                  <div key={ch.channel}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.25rem' }}>
                      <span>{ch.channel}</span>
                      <span>{pct}% ({ch.count})</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: '#0f172a', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#3b82f6' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '1.25rem', backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>
            Delivery Timeline
          </h3>
          {loading ? (
            <p style={{ color: '#94a3b8' }}>Loading timeline...</p>
          ) : timeline.length === 0 ? (
            <p style={{ color: '#94a3b8' }}>No timeline data available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '250px', overflowY: 'auto' }}>
              {timeline.map((item: any, idx: number) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#cbd5e1', padding: '0.5rem 0', borderBottom: '1px solid #334155' }}>
                  <span>{new Date(item.bucket).toLocaleDateString()}</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>{item.successful || item.count || 0} sent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
