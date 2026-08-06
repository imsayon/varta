'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { TextArea } from '@/components/ui/Input/Input';
import { 
  Rocket, 
  Terminal, 
  Trash2, 
  Sparkles, 
  Info,
  Play
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  INotificationTriggerResponse,
  ISubscriber,
  ITemplate,
  TriggerNotificationInput,
} from '@/shared/types/domain';
import type { JsonObject } from '@/shared/types/json';
import styles from './TriggerStudio.module.css';

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'warn';
  message: string;
  timestamp: string;
}

export function TriggerStudio() {
  const { workspace } = useAuth();
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [subscribers, setSubscribers] = useState<ISubscriber[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedSubscriber, setSelectedSubscriber] = useState('');
  const [payloadStr, setPayloadStr] = useState('{\n  "orderId": "ORD-998877",\n  "event": "order_shipped"\n}');
  const [smartTiming, setSmartTiming] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Terminal Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      type,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [...prev, entry]);
  };

  useEffect(() => {
    if (!workspace) return;

    const loadData = async () => {
      setLoading(true);
      const [templatesRes, subscribersRes] = await Promise.all([
        apiClient.get<{ templates: ITemplate[] }>(`/api/v1/workspaces/${workspace.id}/templates`),
        apiClient.get<{ subscribers: ISubscriber[] }>(`/api/v1/workspaces/${workspace.id}/subscribers`)
      ]);

      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data.templates);
        if (templatesRes.data.templates.length > 0) {
          setSelectedTemplate(templatesRes.data.templates[0].id);
        }
      }
      if (subscribersRes.success && subscribersRes.data) {
        setSubscribers(subscribersRes.data.subscribers);
        if (subscribersRes.data.subscribers.length > 0) {
          setSelectedSubscriber(subscribersRes.data.subscribers[0].externalId);
        }
      }
      setLoading(false);
    };

    loadData();
  }, [workspace]);

  // Auto scroll terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !selectedTemplate || !selectedSubscriber) {
      toast.error('Please configure template and subscriber.');
      return;
    }

    let payload: JsonObject = {};
    try {
      if (payloadStr.trim()) {
        payload = JSON.parse(payloadStr);
      }
    } catch {
      toast.error('Payload must be a valid JSON object');
      addLog('error', 'Trigger Aborted: Malformed JSON payload');
      return;
    }

    setTriggering(true);
    const templateName =
      templates.find((template) => template.id === selectedTemplate)?.name ??
      selectedTemplate;
    addLog('info', `Firing trigger: template="${templateName}" recipient="${selectedSubscriber}"...`);

    const requestBody: TriggerNotificationInput = {
      templateId: selectedTemplate,
      subscriberExternalId: selectedSubscriber,
      payload,
      options: {
        smartTiming,
      },
    };

    const res = await apiClient.post<INotificationTriggerResponse>(
      `/api/v1/workspaces/${workspace.id}/notifications/trigger`,
      requestBody
    );

    setTriggering(false);

    if (res.success) {
      toast.success('Notification triggered successfully!');
      addLog('success', 'Pipeline accepted request (200 OK)');
      addLog('info', `Notification ID: ${res.data.notificationId}`);
      if (res.data.channels && res.data.channels.length > 0) {
        addLog('success', `Resolved delivery channels: ${res.data.channels.join(', ')}`);
        if (smartTiming) {
          addLog('info', `Smart Timing enabled: delivery enqueued on BullMQ with ML-predicted user engagement offset.`);
        } else {
          addLog('info', 'Immediate dispatch scheduled: enqueued to channel queues.');
        }
      } else {
        addLog('warn', 'Routing result: 0 active channels. Filtered by subscriber preferences or active routing rules.');
      }
    } else {
      toast.error(res.error.message || 'Failed to trigger notification');
      addLog('error', `Pipeline execution failed: ${res.error.message || 'Unknown network error'}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Trigger Studio</h1>
          <p className={styles.subtitle}>Test your template rendering and rule engine logic in real time</p>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* Left Side: Payload builder */}
        <Card className={styles.studioCard}>
          <h3 className={styles.cardTitle}>Trigger Configuration</h3>

          <form onSubmit={handleTrigger} className={styles.form}>
            <div className={styles.selectGroup}>
              <label className={styles.selectLabel}>Select Template</label>
              <select 
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                disabled={loading || triggering}
                className={styles.select}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
                {templates.length === 0 && <option value="">No templates found</option>}
              </select>
            </div>

            <div className={styles.selectGroup}>
              <label className={styles.selectLabel}>Recipient Subscriber</label>
              <select 
                value={selectedSubscriber}
                onChange={e => setSelectedSubscriber(e.target.value)}
                disabled={loading || triggering}
                className={styles.select}
              >
                {subscribers.map(s => (
                  <option key={s.id} value={s.externalId}>{s.externalId} ({s.email || 'No Email'})</option>
                ))}
                {subscribers.length === 0 && <option value="">No subscribers found</option>}
              </select>
            </div>

            <TextArea
              label="Template Variables (JSON)"
              placeholder='{\n  "variable": "value"\n}'
              value={payloadStr}
              onChange={e => setPayloadStr(e.target.value)}
              rows={6}
              mono
              disabled={triggering}
            />

            <div className={styles.optionsBlock}>
              <label className={`${styles.toggleLabel} ${styles.smartTiming}`}>
                <input
                  type="checkbox"
                  checked={smartTiming}
                  onChange={e => setSmartTiming(e.target.checked)}
                  disabled={triggering}
                />
                <Sparkles size={14} className={styles.sparkle} />
                <span>Smart Timing (ML Dispatch Offset)</span>
              </label>
              <div className={styles.infoTooltip}>
                <Info size={12} />
                <span className={styles.tooltipText}>
                  Queries pgvector for the subscriber&apos;s historical interaction trends to determine their optimal notification open times.
                </span>
              </div>
            </div>

            <Button 
              type="submit" 
              variant="primary" 
              size="lg"
              loading={triggering}
              disabled={templates.length === 0 || subscribers.length === 0}
              className={styles.submitBtn}
            >
              <Rocket size={18} />
              <span>Trigger Notification</span>
            </Button>
          </form>
        </Card>

        {/* Right Side: Log output */}
        <div className={styles.terminalContainer}>
          <div className={styles.terminalHeader}>
            <div className={styles.terminalTitle}>
              <Terminal size={16} />
              <span>Pipeline Logs</span>
            </div>
            {logs.length > 0 && (
              <button onClick={clearLogs} className={styles.clearBtn} title="Clear terminal">
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className={styles.terminalBody}>
            {logs.length === 0 ? (
              <div className={styles.emptyTerminal}>
                <Play size={24} className={styles.playIcon} />
                <p>Configure trigger parameters and click &quot;Trigger Notification&quot; to inspect the delivery lifecycle logs.</p>
              </div>
            ) : (
              <div className={styles.logList}>
                {logs.map((log, index) => (
                  <div key={index} className={`${styles.logEntry} ${styles[log.type]}`}>
                    <span className={styles.logTimestamp}>[{log.timestamp}]</span>
                    <span className={styles.logTag}>
                      {log.type === 'info' && '[INFO]'}
                      {log.type === 'success' && '[SUCCESS]'}
                      {log.type === 'warn' && '[WARN]'}
                      {log.type === 'error' && '[ERROR]'}
                    </span>
                    <span className={styles.logMsg}>{log.message}</span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
