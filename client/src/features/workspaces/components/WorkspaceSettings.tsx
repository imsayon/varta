'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api-client';
import { Card } from '@/components/ui/Card/Card';
import { Input, TextArea } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { CodeBlock } from '@/components/ui/CodeBlock/CodeBlock';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { 
  Settings as SettingsIcon, 
  Key, 
  Mail, 
  Smartphone, 
  Webhook, 
  Sliders, 
  Trash2, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  Lock,
  Plus,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import type { IWorkspace } from '@/shared/types/domain';
import styles from './WorkspaceSettings.module.css';

export function WorkspaceSettings() {
  const { workspace, setActiveWorkspace } = useAuth();
  const [wsData, setWsData] = useState<IWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState('UTC');
  const [emailLimit, setEmailLimit] = useState(1000);
  const [pushLimit, setPushLimit] = useState(5000);

  // Provider config states
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [pushJson, setPushJson] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  // Reveal switches
  const [revealEmail, setRevealEmail] = useState(false);
  const [revealPush, setRevealPush] = useState(false);
  const [revealWebhook, setRevealWebhook] = useState(false);

  // API Key generation
  const [keyLabel, setKeyLabel] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const fetchWorkspace = async () => {
    if (!workspace) return;
    setLoading(true);
    const res = await apiClient.get<IWorkspace>(`/api/v1/workspaces/${workspace.id}`);
    if (res.success && res.data) {
      setWsData(res.data);
      setName(res.data.name);
      setDefaultTimezone(res.data.settings?.defaultTimezone || 'UTC');
      setEmailLimit(res.data.settings?.rateLimits?.emailPerHour || 1000);
      setPushLimit(res.data.settings?.rateLimits?.pushPerHour || 5000);

      // Provider configs
      setEmailApiKey(res.data.providerConfigs?.email?.apiKey || '');
      setEmailFromAddress(res.data.providerConfigs?.email?.fromAddress || '');
      setPushJson(res.data.providerConfigs?.push?.serviceAccountJson || '');
      setWebhookUrl(res.data.providerConfigs?.webhook?.webhookUrl || '');
      setWebhookSecret(res.data.providerConfigs?.webhook?.webhookSecret || '');
    } else {
      toast.error('Failed to load workspace configuration');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspace();
  }, [workspace]);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;

    setSaving(true);
    const payload = {
      name,
      settings: {
        defaultTimezone,
        rateLimits: {
          emailPerHour: emailLimit,
          pushPerHour: pushLimit
        }
      },
      providerConfigs: {
        email: {
          provider: 'resend',
          apiKey: emailApiKey,
          fromAddress: emailFromAddress
        },
        push: {
          provider: 'fcm',
          serviceAccountJson: pushJson
        },
        webhook: {
          provider: 'webhook',
          webhookUrl,
          webhookSecret
        }
      }
    };

    const res = await apiClient.put<IWorkspace>(
      `/api/v1/workspaces/${workspace.id}`,
      payload
    );

    setSaving(false);
    if (res.success && res.data) {
      toast.success('Workspace settings updated successfully.');
      setActiveWorkspace({ id: res.data._id, name: res.data.name });
      fetchWorkspace();
    } else {
      toast.error(res.error?.message || 'Failed to save settings');
    }
  };

  const handleGenerateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyLabel.trim() || !workspace) return;

    setGeneratingKey(true);
    const res = await apiClient.post<{ rawKey: string; label: string }>(
      `/api/v1/workspaces/${workspace.id}/api-keys`,
      { label: keyLabel }
    );
    setGeneratingKey(false);

    if (res.success && res.data) {
      setNewRawKey(res.data.rawKey);
      setKeyLabel('');
      toast.success('API Key generated successfully. Copy it now, it won\'t be shown again!');
      fetchWorkspace();
    } else {
      toast.error(res.error?.message || 'Failed to generate key');
    }
  };

  const copyToClipboard = async () => {
    if (!newRawKey) return;
    try {
      await navigator.clipboard.writeText(newRawKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Ignore
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingGrid}>
        <Skeleton height={200} />
        <Skeleton height={400} />
        <Skeleton height={200} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Configure provider credentials, API integration tokens, and workspace limits</p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Main Settings Form */}
        <form onSubmit={handleSaveWorkspace} className={styles.mainForm}>
          {/* General Config */}
          <Card className={styles.settingsCard}>
            <h3 className={styles.cardTitle}>
              <SettingsIcon size={16} />
              <span>Workspace General</span>
            </h3>
            <div className={styles.row}>
              <Input
                label="Workspace Name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                disabled={saving}
              />
              <Input
                label="Default Timezone"
                value={defaultTimezone}
                onChange={e => setDefaultTimezone(e.target.value)}
                required
                disabled={saving}
              />
            </div>
          </Card>

          {/* Integration Provider configs */}
          <Card className={styles.settingsCard}>
            <h3 className={styles.cardTitle}>
              <Key size={16} />
              <span>Delivery Providers</span>
            </h3>

            <div className={styles.providerBox}>
              <div className={styles.providerHeader}>
                <div className={styles.providerTitle}>
                  <Mail size={18} className={styles.emailIcon} />
                  <span>Email Channel (Resend)</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setRevealEmail(!revealEmail)}
                  className={styles.revealBtn}
                >
                  {revealEmail ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className={styles.providerFields}>
                <Input
                  type={revealEmail ? 'text' : 'password'}
                  label="Resend API Key"
                  placeholder="re_••••••••••••••••"
                  value={emailApiKey}
                  onChange={e => setEmailApiKey(e.target.value)}
                  disabled={saving}
                />
                <Input
                  label="From Address"
                  placeholder="Varta Alerts <alerts@yourdomain.com>"
                  value={emailFromAddress}
                  onChange={e => setEmailFromAddress(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className={styles.providerBox}>
              <div className={styles.providerHeader}>
                <div className={styles.providerTitle}>
                  <Smartphone size={18} className={styles.pushIcon} />
                  <span>Push Channel (Firebase FCM)</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setRevealPush(!revealPush)}
                  className={styles.revealBtn}
                >
                  {revealPush ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <TextArea
                label="FCM Service Account JSON"
                placeholder='{"type": "service_account", ...}'
                value={revealPush ? pushJson : (pushJson ? '••••••••••••••••' : '')}
                onChange={e => setPushJson(e.target.value)}
                disabled={saving || !revealPush}
                mono
                rows={4}
              />
            </div>

            <div className={styles.providerBox}>
              <div className={styles.providerHeader}>
                <div className={styles.providerTitle}>
                  <Webhook size={18} className={styles.webhookIcon} />
                  <span>Outgoing Webhook Destination</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setRevealWebhook(!revealWebhook)}
                  className={styles.revealBtn}
                >
                  {revealWebhook ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className={styles.providerFields}>
                <Input
                  label="Webhook URL"
                  placeholder="https://yourserver.com/webhooks/varta"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  disabled={saving}
                />
                <Input
                  type={revealWebhook ? 'text' : 'password'}
                  label="Signing Secret"
                  placeholder="Masked signing secret"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
          </Card>

          {/* Rate limiting controls */}
          <Card className={styles.settingsCard}>
            <h3 className={styles.cardTitle}>
              <Sliders size={16} />
              <span>Workspace Throttle Limits</span>
            </h3>
            <div className={styles.row}>
              <Input
                type="number"
                label="Maximum Email Sends / Hour"
                value={emailLimit}
                onChange={e => setEmailLimit(parseInt(e.target.value) || 0)}
                disabled={saving}
              />
              <Input
                type="number"
                label="Maximum Mobile Push / Hour"
                value={pushLimit}
                onChange={e => setPushLimit(parseInt(e.target.value) || 0)}
                disabled={saving}
              />
            </div>
          </Card>

          <Button type="submit" variant="primary" loading={saving} className={styles.saveBtn}>
            <Lock size={16} />
            <span>Save Configuration</span>
          </Button>
        </form>

        {/* API keys listing */}
        <div className={styles.sideColumn}>
          <Card className={styles.settingsCard}>
            <h3 className={styles.cardTitle}>
              <Key size={16} />
              <span>API Integration Keys</span>
            </h3>

            {newRawKey && (
              <div className={styles.newKeyBox}>
                <div className={styles.newKeyHeader}>
                  <span>Copy API key:</span>
                  <button onClick={copyToClipboard} className={styles.copyBtn}>
                    {copiedKey ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className={styles.rawKeyValue}>
                  {newRawKey}
                </div>
                <p className={styles.warningText}>This key will not be shown again. Save it securely.</p>
              </div>
            )}

            <form onSubmit={handleGenerateApiKey} className={styles.generateForm}>
              <Input
                label="Generate API Key"
                placeholder="Key label, e.g. Node Backend"
                value={keyLabel}
                onChange={e => setKeyLabel(e.target.value)}
                required
                disabled={generatingKey}
              />
              <Button type="submit" variant="secondary" loading={generatingKey}>
                <Plus size={14} />
                <span>Generate Key</span>
              </Button>
            </form>

            <div className={styles.keysList}>
              <span className={styles.label}>Active Access Keys:</span>
              {wsData?.apiKeys.map((k, i) => (
                <div key={i} className={styles.keyItem}>
                  <span className={styles.keyLabelText}>{k.label}</span>
                  <span className={styles.keyDate}>Created {new Date(k.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {wsData?.apiKeys.length === 0 && (
                <span className={styles.noKeys}>No API Keys generated yet</span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
