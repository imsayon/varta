'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card/Card';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { apiClient } from '@/shared/api/api';
import { useAuth } from '@/shared/auth/auth-context';
import type { IApiKey, IApiKeyCreateResponse } from '@/shared/types/domain';

type ApiKeyItem = IApiKey;

export default function ApiKeysPage() {
  const { workspace } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [scopes, setScopes] = useState<string[]>(['notifications:trigger']);

  const fetchKeys = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const res = await apiClient.get<ApiKeyItem[]>(`/api/v1/workspaces/${workspace.id}/api-keys`);
    if (res.success) {
      setKeys(res.data);
    } else {
      toast.error(res.error?.message || 'Failed to load API keys');
      setKeys([]);
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchKeys(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace || !name.trim()) return;

    setIsCreating(true);
    setCreatedSecret(null);

    const res = await apiClient.post<IApiKeyCreateResponse>(`/api/v1/workspaces/${workspace.id}/api-keys`, {
      name: name.trim(),
      permissions: scopes,
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
    });

    setIsCreating(false);

    if (res.success) {
      const newKey = res.data;
      setCreatedSecret(newKey.fullKey);
      setName('');
      setExpiresAt('');
      toast.success('API key created. Copy it now; Varta cannot show it again.');
      fetchKeys();
    } else {
      toast.error(res.error?.message || 'Failed to create API key');
    }
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret);
    toast.success('API key copied');
  };

  const availableScopes = [
    'notifications:trigger',
    'notifications:retry',
    'subscribers:read',
    'subscribers:write',
    'subscribers:ws-token',
  ];

  const handleRevoke = async (keyId: string) => {
    if (!workspace) return;
    const res = await apiClient.del(`/api/v1/workspaces/${workspace.id}/api-keys/${keyId}`);
    if (res.success) {
      toast.success('API key revoked');
      fetchKeys();
    } else {
      toast.error(res.error?.message || 'Failed to revoke API key');
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>
        API Keys
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Manage access keys for triggering notifications and accessing Varta APIs.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <Card padding="lg">
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>
            Create New API Key
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ flex: 1 }}>
              <Input
                type="text"
                label="Key Name"
                placeholder="e.g. Production Backend"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                required
              />
            </div>
            <Input
              type="datetime-local"
              label="Expiry (optional)"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              disabled={isCreating}
            />
            <fieldset style={{ border: 0, padding: 0 }}>
              <legend style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Scopes</legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {availableScopes.map((scope) => (
                  <label key={scope} style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={(event) => setScopes((current) => event.target.checked
                        ? [...current, scope]
                        : current.filter((item) => item !== scope))}
                    />{' '}{scope}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" variant="primary" loading={isCreating}>
              Create Key
            </Button>
          </form>

          {createdSecret && (
            <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#0f172a', borderRadius: '0.375rem', border: '1px solid #10b981' }}>
              <p style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 600, marginBottom: '0.25rem' }}>
                Save your API key! It will not be shown again:
              </p>
              <code style={{ fontSize: '0.875rem', color: '#38bdf8', wordBreak: 'break-all' }}>
                {createdSecret}
              </code>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <Button type="button" size="sm" onClick={copySecret}>Copy</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setCreatedSecret(null)}>I saved it</Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card padding="lg">
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#f8fafc', marginBottom: '1rem' }}>
          Active Keys
        </h3>

        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading keys...</p>
        ) : keys.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No API keys created yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {keys.map((k) => (
              <div key={k.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem',
                backgroundColor: '#1e293b',
                borderRadius: '0.375rem',
                border: '1px solid #334155'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc' }}>{k.name}</div>
                  <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                    Prefix: {k.prefix || k.id.substring(0, 8)}...
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Created: {new Date(k.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Scopes: {k.permissions?.join(', ') || 'none'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Expires: {k.expiresAt ? new Date(k.expiresAt).toLocaleString() : 'never'} · Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => handleRevoke(k.id)}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
