'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Key, Plus, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import styles from './ApiKeysPage.module.css';

export default function ApiKeysPage() {
  const { workspace } = useAuth();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');

  const fetchApiKeys = async () => {
    if (!workspace) return;
    const res = await apiClient.get<any[]>(`/api/v1/workspaces/${workspace.id}/api-keys`);
    if (res.success && res.data) {
      setApiKeys(res.data);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, [workspace]);

  const handleCreate = async () => {
    if (!workspace || !newKeyName) return;
    const res = await apiClient.post<any>(`/api/v1/workspaces/${workspace.id}/api-keys`, { name: newKeyName });
    if (res.success && res.data) {
      toast.success('API Key created');
      setGeneratedKey(res.data.fullKey);
      fetchApiKeys();
    } else {
      toast.error(res.error?.message || 'Failed to create key');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!workspace || !confirm(`Revoke key "${name}"? This cannot be undone.`)) return;
    const res = await apiClient.get(`/api/v1/workspaces/${workspace.id}/api-keys/${id}`);
    if (res.success) {
      toast.success('API Key revoked');
      fetchApiKeys();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>API Keys</h1>
          <p className={styles.subtitle}>Manage keys for authenticating API requests</p>
        </div>
        <Button variant="primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Generate New Key</span>
        </Button>
      </div>

      {apiKeys.length === 0 ? (
        <div className={styles.emptyContainer}>
          <EmptyState
            title="No API Keys"
            description="Create an API key to start integrating Varta into your applications."
            icon={<Key />}
            actionLabel="Generate Key"
            onAction={() => setIsModalOpen(true)}
          />
        </div>
      ) : (
        <Card className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Prefix</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(key => (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td className={styles.monoId}>{key.prefix}••••••••</td>
                    <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className={styles.actions}>
                        <button onClick={() => handleDelete(key.id, key.name)} className={styles.deleteBtn}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h2 className={styles.title}>Generate API Key</h2>
            
            {generatedKey ? (
              <div>
                <p className={styles.subtitle} style={{ marginBottom: '1rem' }}>
                  Please copy this key now. You will not be able to see it again!
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
                  <input readOnly value={generatedKey} className={styles.input} />
                  <Button variant="secondary" onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    toast.success('Copied to clipboard');
                  }}>
                    <Copy size={16} />
                  </Button>
                </div>
                <div className={styles.modalActions}>
                  <Button variant="primary" onClick={() => {
                    setIsModalOpen(false);
                    setGeneratedKey('');
                    setNewKeyName('');
                  }}>Done</Button>
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.formGroup} style={{ marginTop: '1.5rem' }}>
                  <label>Key Name</label>
                  <input 
                    className={styles.input}
                    value={newKeyName} 
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="e.g. Production Backend"
                    autoFocus
                  />
                </div>
                <div className={styles.modalActions}>
                  <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                  <Button variant="primary" onClick={handleCreate} disabled={!newKeyName}>Generate</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
