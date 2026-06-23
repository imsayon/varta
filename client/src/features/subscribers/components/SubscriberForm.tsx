'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input, TextArea } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { toast } from 'sonner';
import type { ISubscriber } from '@/shared/types/domain';
import styles from './SubscriberForm.module.css';

interface SubscriberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: ISubscriber | null;
}

export function SubscriberForm({ isOpen, onClose, onSubmit, initialData }: SubscriberFormProps) {
  const [externalId, setExternalId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pushToken, setPushToken] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [locale, setLocale] = useState('en-US');
  const [attributesStr, setAttributesStr] = useState('{\n  "name": "Jane Doe",\n  "plan": "premium"\n}');
  
  // Preferences
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefPush, setPrefPush] = useState(true);
  const [prefInApp, setPrefInApp] = useState(true);
  const [prefWebhook, setPrefWebhook] = useState(true);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setExternalId(initialData.externalId);
      setEmail(initialData.email || '');
      setPhone(initialData.phone || '');
      setPushToken(initialData.pushToken || '');
      setTimezone(initialData.timezone || 'UTC');
      setLocale(initialData.locale || 'en-US');
      setAttributesStr(JSON.stringify(initialData.attributes || {}, null, 2));

      // Channels
      const prefs = initialData.channelPreferences || {};
      setPrefEmail(prefs.email !== false);
      setPrefPush(prefs.push !== false);
      setPrefInApp(prefs.inapp !== false);
      setPrefWebhook(prefs.webhook !== false);
    } else {
      setExternalId('');
      setEmail('');
      setPhone('');
      setPushToken('');
      setTimezone('UTC');
      setLocale('en-US');
      setAttributesStr('{\n  "name": "Jane Doe",\n  "plan": "premium"\n}');
      setPrefEmail(true);
      setPrefPush(true);
      setPrefInApp(true);
      setPrefWebhook(true);
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalId.trim()) return;

    let attributes = {};
    try {
      if (attributesStr.trim()) {
        attributes = JSON.parse(attributesStr);
      }
    } catch {
      toast.error('Subscriber attributes must be a valid JSON string');
      return;
    }

    setLoading(true);

    const payload = {
      externalId,
      email: email || undefined,
      phone: phone || undefined,
      pushToken: pushToken || undefined,
      timezone,
      locale,
      attributes,
      channelPreferences: {
        email: prefEmail,
        push: prefPush,
        inapp: prefInApp,
        webhook: prefWebhook,
      }
    };

    try {
      await onSubmit(payload);
      onClose();
    } catch {
      // Handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Subscriber' : 'Add Subscriber'}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row}>
          <Input
            label="External ID (Unique Identifier)"
            placeholder="usr_123456"
            value={externalId}
            onChange={e => setExternalId(e.target.value)}
            required
            disabled={!!initialData || loading}
          />
          <Input
            label="Email Address"
            placeholder="jane@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className={styles.row}>
          <Input
            label="Phone Number"
            placeholder="+1234567890"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Push Token"
            placeholder="FCM token or device identifier"
            value={pushToken}
            onChange={e => setPushToken(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className={styles.row}>
          <Input
            label="Timezone (IANA)"
            placeholder="America/New_York"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            disabled={loading}
          />
          <Input
            label="Locale (BCP-47)"
            placeholder="en-US"
            value={locale}
            onChange={e => setLocale(e.target.value)}
            disabled={loading}
          />
        </div>

        {/* Preferences */}
        <div className={styles.preferenceSection}>
          <span className={styles.label}>Opt-in Channels:</span>
          <div className={styles.prefGrid}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={prefEmail}
                onChange={e => setPrefEmail(e.target.checked)}
                disabled={loading}
              />
              <span>Email</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={prefPush}
                onChange={e => setPrefPush(e.target.checked)}
                disabled={loading}
              />
              <span>Push</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={prefInApp}
                onChange={e => setPrefInApp(e.target.checked)}
                disabled={loading}
              />
              <span>In-App</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={prefWebhook}
                onChange={e => setPrefWebhook(e.target.checked)}
                disabled={loading}
              />
              <span>Webhook</span>
            </label>
          </div>
        </div>

        <TextArea
          label="Custom Attributes (JSON)"
          placeholder='{\n  "plan": "premium"\n}'
          value={attributesStr}
          onChange={e => setAttributesStr(e.target.value)}
          rows={5}
          mono
          disabled={loading}
        />

        <div className={styles.footerActions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {initialData ? 'Save Changes' : 'Add Subscriber'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
