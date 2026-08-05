'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { apiClient } from '@/shared/api/api';
import { useAuth } from '@/shared/auth/auth-context';

export default function StudioPage() {
  const { workspace } = useAuth();
  const [subscriberId, setSubscriberId] = useState('');
  const [channel, setChannel] = useState<'EMAIL' | 'IN_APP' | 'WEBHOOK'>('EMAIL');
  const [templateId, setTemplateId] = useState('');
  const [payloadJson, setPayloadJson] = useState('{\n  "name": "Alex",\n  "action": "login"\n}');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [triggerResult, setTriggerResult] = useState<any>(null);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) {
      toast.error('No workspace selected');
      return;
    }
    if (!subscriberId.trim()) {
      toast.error('Subscriber ID is required');
      return;
    }

    let parsedPayload = {};
    try {
      if (payloadJson.trim()) {
        parsedPayload = JSON.parse(payloadJson);
      }
    } catch {
      toast.error('Invalid JSON payload');
      return;
    }

    setIsSubmitting(true);
    setTriggerResult(null);

    const res = await apiClient.post(`/api/v1/workspaces/${workspace.id}/notifications/trigger`, {
      subscriberId,
      channels: [channel],
      templateId: templateId.trim() || undefined,
      payload: parsedPayload,
    });

    setIsSubmitting(false);

    if (res.success) {
      setTriggerResult(res.data);
      toast.success('Notification triggered successfully!');
    } else {
      const msg = res.error?.message || 'Trigger failed';
      toast.error(msg);
      setTriggerResult({ error: msg });
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
        Trigger Studio
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Send real test notification events through your workspace pipeline.
      </p>

      <Card padding="lg">
        <form onSubmit={handleTrigger}>
          <Input
            type="text"
            label="Subscriber ID"
            placeholder="sub_12345"
            value={subscriberId}
            onChange={(e) => setSubscriberId(e.target.value)}
            disabled={isSubmitting}
            required
          />

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.5rem' }}>
              Channel
            </label>
            <select
              value={channel}
              onChange={(e: any) => setChannel(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
              }}
            >
              <option value="EMAIL">Email</option>
              <option value="IN_APP">In-App</option>
              <option value="WEBHOOK">Webhook</option>
            </select>
          </div>

          <Input
            type="text"
            label="Template ID (Optional)"
            placeholder="tmpl_12345"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            disabled={isSubmitting}
          />

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8', marginBottom: '0.5rem' }}>
              Variables Payload (JSON)
            </label>
            <textarea
              rows={4}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem',
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                fontFamily: 'monospace',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
              }}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            style={{ width: '100%', marginTop: '1rem' }}
          >
            Trigger Event
          </Button>
        </form>

        {triggerResult && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #334155' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
              API Execution Output
            </h3>
            <pre style={{
              backgroundColor: '#0f172a',
              padding: '1rem',
              borderRadius: '0.375rem',
              color: triggerResult.error ? '#ef4444' : '#10b981',
              fontSize: '0.875rem',
              overflowX: 'auto',
            }}>
              {JSON.stringify(triggerResult, null, 2)}
            </pre>
          </div>
        )}
      </Card>
    </div>
  );
}
