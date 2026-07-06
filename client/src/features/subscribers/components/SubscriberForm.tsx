'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal/Modal';
import { Input, TextArea } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { toast } from 'sonner';
import type { ISubscriber, SubscriberPreferences, SubscriberUpsertInput } from '@/shared/types/domain';
import type { JsonObject } from '@/shared/types/json';
import styles from './SubscriberForm.module.css';

interface SubscriberFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SubscriberUpsertInput) => Promise<void>;
  initialData?: ISubscriber | null;
}

function getInitialSubscriberFormState(initialData?: ISubscriber | null) {
  const preferences = initialData?.preferences;

  return {
    externalId: initialData?.externalId ?? '',
    email: initialData?.email ?? '',
    name: initialData?.name ?? '',
    timezone: initialData?.timezone ?? 'UTC',
    locale: initialData?.locale ?? 'en-US',
    attributesStr: JSON.stringify(initialData?.attributes ?? { name: 'Jane Doe', plan: 'premium' }, null, 2),
    prefEmail: preferences?.email !== false,
    prefPush: preferences?.push !== false,
    prefInApp: preferences?.inapp !== false,
    prefWebhook: preferences?.webhook !== false,
  };
}

export function SubscriberForm({ isOpen, onClose, onSubmit, initialData }: SubscriberFormProps) {
  const initialState = getInitialSubscriberFormState(initialData);
  const [externalId, setExternalId] = useState(initialState.externalId);
  const [email, setEmail] = useState(initialState.email);
  const [name, setName] = useState(initialState.name);
  const [timezone, setTimezone] = useState(initialState.timezone);
  const [locale, setLocale] = useState(initialState.locale);
  const [attributesStr, setAttributesStr] = useState(initialState.attributesStr);
  
  // Preferences
  const [prefEmail, setPrefEmail] = useState(initialState.prefEmail);
  const [prefPush, setPrefPush] = useState(initialState.prefPush);
  const [prefInApp, setPrefInApp] = useState(initialState.prefInApp);
  const [prefWebhook, setPrefWebhook] = useState(initialState.prefWebhook);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!externalId.trim()) return;

    let attributes: JsonObject = {};
    try {
      if (attributesStr.trim()) {
        attributes = JSON.parse(attributesStr);
      }
    } catch {
      toast.error('Subscriber attributes must be a valid JSON string');
      return;
    }

    setLoading(true);

    const preferences: SubscriberPreferences = {
      email: prefEmail,
      push: prefPush,
      inapp: prefInApp,
      webhook: prefWebhook,
    };

    const payload: SubscriberUpsertInput = {
      externalId,
      email: email || undefined,
      name: name || undefined,
      timezone,
      locale,
      attributes,
      preferences,
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
            label="Name"
            placeholder="Jane Doe"
            value={name}
            onChange={e => setName(e.target.value)}
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
