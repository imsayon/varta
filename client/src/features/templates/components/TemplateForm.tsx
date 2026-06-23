'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input, TextArea } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { Sparkles } from 'lucide-react';
import type { ITemplate } from '@/shared/types/domain';
import styles from './TemplateForm.module.css';

interface TemplateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: ITemplate | null;
}

type ChannelTab = 'email' | 'inapp' | 'push' | 'webhook';

export function TemplateForm({ isOpen, onClose, onSubmit, initialData }: TemplateFormProps) {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [aiPersonalize, setAiPersonalize] = useState(false);
  const [activeTab, setActiveTab] = useState<ChannelTab>('email');
  const [loading, setLoading] = useState(false);

  // Email Config
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // In-App Config
  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppBody, setInAppBody] = useState('');
  const [inAppActionUrl, setInAppActionUrl] = useState('');

  // Push Config
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');

  // Webhook Config
  const [webhookPayload, setWebhookPayload] = useState('{\n  "event": "{{event}}",\n  "userId": "{{subscriber.id}}"\n}');

  // Populated fields when editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setActive(initialData.active);
      setAiPersonalize(initialData.aiPersonalize || false);

      setEmailSubject(initialData.channels.email?.subject || '');
      setEmailBody(initialData.channels.email?.htmlBody || '');

      setInAppTitle(initialData.channels.inapp?.title || '');
      setInAppBody(initialData.channels.inapp?.body || '');
      setInAppActionUrl(initialData.channels.inapp?.actionUrl || '');

      setPushTitle(initialData.channels.push?.title || '');
      setPushBody(initialData.channels.push?.body || '');

      setWebhookPayload(initialData.channels.webhook?.payload || '{\n  "event": "{{event}}",\n  "userId": "{{subscriber.id}}"\n}');
    } else {
      // Reset form on create mode
      setName('');
      setActive(true);
      setAiPersonalize(false);
      setEmailSubject('');
      setEmailBody('');
      setInAppTitle('');
      setInAppBody('');
      setInAppActionUrl('');
      setPushTitle('');
      setPushBody('');
      setWebhookPayload('{\n  "event": "{{event}}",\n  "userId": "{{subscriber.id}}"\n}');
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);

    const channels: any = {};
    if (emailSubject || emailBody) {
      channels.email = { subject: emailSubject, htmlBody: emailBody };
    }
    if (inAppTitle || inAppBody) {
      channels.inapp = { title: inAppTitle, body: inAppBody, actionUrl: inAppActionUrl };
    }
    if (pushTitle || pushBody) {
      channels.push = { title: pushTitle, body: pushBody };
    }
    if (webhookPayload) {
      channels.webhook = { payload: webhookPayload };
    }

    const payload = {
      name,
      active,
      aiPersonalize,
      channels,
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Error is caught by parent
    } finally {
      setLoading(false);
    }
  };

  const tabs: { value: ChannelTab; label: string }[] = [
    { value: 'email', label: 'Email' },
    { value: 'inapp', label: 'In-App' },
    { value: 'push', label: 'Mobile Push' },
    { value: 'webhook', label: 'Webhook' },
  ];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={initialData ? 'Edit Template' : 'Create Notification Template'}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.metadataRow}>
          <Input
            label="Template Name"
            placeholder="e.g. order_shipped"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            disabled={!!initialData || loading} // Name cannot be changed if editing
            className={styles.nameInput}
          />

          <div className={styles.optionsCol}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                disabled={loading}
              />
              <span>Active</span>
            </label>

            <label className={`${styles.toggleLabel} ${styles.aiLabel}`}>
              <input
                type="checkbox"
                checked={aiPersonalize}
                onChange={e => setAiPersonalize(e.target.checked)}
                disabled={loading}
              />
              <Sparkles size={14} className={styles.sparkle} />
              <span>AI Personalization</span>
            </label>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabsHeader}>
          {tabs.map(tab => {
            const hasConfig = 
              (tab.value === 'email' && (emailSubject || emailBody)) ||
              (tab.value === 'inapp' && (inAppTitle || inAppBody)) ||
              (tab.value === 'push' && (pushTitle || pushBody)) ||
              (tab.value === 'webhook' && webhookPayload && webhookPayload.length > 5);

            return (
              <button
                key={tab.value}
                type="button"
                className={`${styles.tabBtn} ${activeTab === tab.value ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.value)}
              >
                <span>{tab.label}</span>
                {hasConfig && <span className={styles.activeDot} />}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'email' && (
            <div className={styles.pane}>
              <Input
                label="Subject Line"
                placeholder="Your order {{orderId}} has shipped!"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                disabled={loading}
              />
              <TextArea
                label="HTML Body (Handlebars supported)"
                placeholder="<h1>Hello {{subscriber.attributes.name}}</h1><p>Your order is on the way...</p>"
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={8}
                mono
                disabled={loading}
              />
            </div>
          )}

          {activeTab === 'inapp' && (
            <div className={styles.pane}>
              <Input
                label="Notification Title"
                placeholder="Alert"
                value={inAppTitle}
                onChange={e => setInAppTitle(e.target.value)}
                disabled={loading}
              />
              <TextArea
                label="Body Text"
                placeholder="Hi {{subscriber.attributes.name}}, you received a new message."
                value={inAppBody}
                onChange={e => setInAppBody(e.target.value)}
                rows={4}
                disabled={loading}
              />
              <Input
                label="Action Link (Optional URL)"
                placeholder="/dashboard/orders/{{orderId}}"
                value={inAppActionUrl}
                onChange={e => setInAppActionUrl(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          {activeTab === 'push' && (
            <div className={styles.pane}>
              <Input
                label="Alert Title"
                placeholder="Notification"
                value={pushTitle}
                onChange={e => setPushTitle(e.target.value)}
                disabled={loading}
              />
              <TextArea
                label="Alert Body (160 chars recommended)"
                placeholder="Hi {{subscriber.attributes.name}}, your order has shipped!"
                value={pushBody}
                onChange={e => setPushBody(e.target.value)}
                rows={4}
                disabled={loading}
              />
            </div>
          )}

          {activeTab === 'webhook' && (
            <div className={styles.pane}>
              <TextArea
                label="JSON Payload (Interpolated at runtime)"
                placeholder='{\n  "event": "{{event}}"\n}'
                value={webhookPayload}
                onChange={e => setWebhookPayload(e.target.value)}
                rows={8}
                mono
                disabled={loading}
              />
            </div>
          )}
        </div>

        <div className={styles.footerActions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {initialData ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
