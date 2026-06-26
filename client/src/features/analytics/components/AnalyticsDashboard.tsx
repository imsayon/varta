'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api-client';
import { StatCard } from '@/components/ui/StatCard/StatCard';
import { Card } from '@/components/ui/Card/Card';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Badge } from '@/components/ui/Badge/Badge';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle,
  Inbox
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import styles from './AnalyticsDashboard.module.css';

interface AnalyticsData {
  total: number;
  status: {
    completed: number;
    failed: number;
    processing: number;
    pending: number;
  };
  channels: {
    email: number;
    push: number;
    inapp: number;
    webhook: number;
  };
  trend: Array<{ _id: string; count: number }>;
  recent: Array<{
    _id: string;
    subscriberId: string;
    channels: string[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    triggeredAt: string;
  }>;
}

export function AnalyticsDashboard() {
  const { workspace } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!workspace) return;

    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<AnalyticsData>(
        `/api/v1/workspaces/${workspace?.id}/notifications/analytics`
      );
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to fetch analytics');
      }
      setLoading(false);
    }

    fetchAnalytics();
  }, [workspace]);

  if (!workspace) {
    return (
      <EmptyState
        title="No Workspace Selected"
        description="Please select or create a workspace to view analytics."
        icon={<AlertCircle />}
      />
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingGrid}>
        <div className={styles.statsRow}>
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
          <Skeleton height={110} />
        </div>
        <div className={styles.chartsRow}>
          <Skeleton height={300} />
          <Skeleton height={300} />
        </div>
        <Skeleton height={400} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Something went wrong"
        description={error || 'Failed to load dashboard statistics.'}
        icon={<AlertCircle />}
      />
    );
  }

  // Pre-process trend data for chart
  const chartData = data.trend.map(item => ({
    name: new Date(item._id).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    count: item.count
  }));

  // Fill in empty days if trend is sparse
  if (chartData.length === 0) {
    chartData.push({ name: 'No Data', count: 0 });
  }

  // Pre-process channel data
  const channelData = [
    { name: 'Email', count: data.channels.email, color: '#6366f1' },
    { name: 'Push', count: data.channels.push, color: '#8b5cf6' },
    { name: 'In-App', count: data.channels.inapp, color: '#06b6d4' },
    { name: 'Webhook', count: data.channels.webhook, color: '#10b981' }
  ];

  return (
    <div className={styles.container}>
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Overview</h1>
          <p className={styles.subtitle}>Real-time system health and delivery metrics</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={styles.statsRow}>
        <StatCard
          label="Total Triggered"
          value={data.total}
          icon={<Send />}
          color="indigo"
          delay={0}
        />
        <StatCard
          label="Delivered"
          value={data.status.completed}
          icon={<CheckCircle2 />}
          color="emerald"
          delay={1}
        />
        <StatCard
          label="Failed"
          value={data.status.failed}
          icon={<XCircle />}
          color="rose"
          delay={2}
        />
        <StatCard
          label="Processing"
          value={data.status.processing + data.status.pending}
          icon={<Loader2 className="animate-spin" />}
          color="cyan"
          delay={3}
        />
      </div>

      {/* Charts section */}
      {isMounted && (
        <div className={styles.chartsRow}>
          {/* Trend Area Chart */}
          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Delivery Volume Trends (Last 7 Days)</h3>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0d0e1c',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#trendGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Channel distribution Bar Chart */}
          <Card className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Channel Distribution</h3>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={channelData}>
                  <XAxis 
                    dataKey="name" 
                    stroke="#475569" 
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{
                      background: '#0d0e1c',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {/* Recent Activity Feed */}
      <Card className={styles.tableCard}>
        <h3 className={styles.tableTitle}>Recent Delivery Pipeline Logs</h3>
        <div className={styles.tableWrapper}>
          {data.recent.length === 0 ? (
            <div className={styles.emptyTable}>
              <Inbox size={48} className="text-muted" />
              <p>No notifications have been triggered yet.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Notification ID</th>
                  <th>Subscriber ID</th>
                  <th>Channels</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map(notif => (
                  <tr key={notif._id}>
                    <td className={styles.monoId}>{notif._id}</td>
                    <td className={styles.monoId}>{notif.subscriberId}</td>
                    <td>
                      <div className={styles.badgeList}>
                        {notif.channels.map(ch => (
                          <Badge key={ch} variant={ch as any} size="sm">
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.statusLabel} ${styles[notif.status]}`}>
                        {notif.status}
                      </span>
                    </td>
                    <td className={styles.timeLabel}>
                      {new Date(notif.triggeredAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
