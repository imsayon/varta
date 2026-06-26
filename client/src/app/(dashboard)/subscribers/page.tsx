'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api-client';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { SubscriberForm } from '@/features/subscribers/components/SubscriberForm';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Check, 
  X,
  Clock,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import type { ISubscriber } from '@/shared/types/domain';
import styles from './SubscribersPage.module.css';

export default function SubscribersPage() {
  const { workspace } = useAuth();
  const [subscribers, setSubscribers] = useState<ISubscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<ISubscriber | null>(null);

  const fetchSubscribers = async () => {
    if (!workspace) return;
    setLoading(true);
    const res = await apiClient.get<ISubscriber[]>(`/api/v1/workspaces/${workspace.id}/subscribers`);
    if (res.success && res.data) {
      setSubscribers(res.data);
    } else {
      toast.error(res.error?.message || 'Failed to fetch subscribers');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSubscribers();
  }, [workspace]);

  const handleCreateOrUpdate = async (formData: any) => {
    if (!workspace) return;

    const res = await apiClient.post<ISubscriber>(
      `/api/v1/workspaces/${workspace.id}/subscribers`,
      formData
    );
    if (res.success) {
      toast.success(
        editingSubscriber 
          ? `Subscriber "${formData.externalId}" updated.` 
          : `Subscriber "${formData.externalId}" added successfully.`
      );
      fetchSubscribers();
    } else {
      toast.error(res.error?.message || 'Failed to save subscriber');
      throw new Error();
    }
  };

  const handleDelete = async (id: string, externalId: string) => {
    if (!workspace || !confirm(`Delete subscriber "${externalId}"? All delivery data will remain, but preferences will be lost.`)) return;

    const res = await apiClient.del(`/api/v1/workspaces/${workspace.id}/subscribers/${id}`);
    if (res.success) {
      toast.success(`Subscriber "${externalId}" deleted.`);
      setSubscribers(prev => prev.filter(s => s.id !== id));
    } else {
      toast.error(res.error?.message || 'Failed to delete subscriber');
    }
  };

  const filteredSubscribers = subscribers.filter(s => 
    s.externalId.toLowerCase().includes(search.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Subscribers</h1>
          <p className={styles.subtitle}>Manage notification recipients, timezone settings, and delivery channels preferences</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => {
            setEditingSubscriber(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={18} />
          <span>Add Subscriber</span>
        </Button>
      </div>

      {/* Controls Bar */}
      {subscribers.length > 0 && (
        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by ID or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      )}

      {/* Subscribers Grid / Table */}
      {loading ? (
        <div className={styles.skeletonGrid}>
          <Skeleton height={50} />
          <Skeleton height={50} />
          <Skeleton height={50} />
        </div>
      ) : filteredSubscribers.length === 0 ? (
        <div className={styles.emptyContainer}>
          <EmptyState
            title={search ? 'No matches found' : 'No subscribers yet'}
            description={search ? 'Try checking your search criteria.' : 'Create subscribers in the dashboard, or trigger them via API call to build your routing list.'}
            icon={<Users />}
            actionLabel={search ? undefined : 'Add Subscriber'}
            onAction={search ? undefined : () => setIsModalOpen(true)}
          />
        </div>
      ) : (
        <Card className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Subscriber ID</th>
                  <th>Contact Info</th>
                  <th>Channels Opt-In</th>
                  <th>Preferences</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map(sub => {
                  const prefs = sub.channelPreferences || {};

                  return (
                    <tr key={sub.id}>
                      <td className={styles.monoId}>{sub.externalId}</td>
                      <td>
                        <div className={styles.contactInfo}>
                          {sub.email && <span className={styles.emailText}>{sub.email}</span>}
                          {sub.phone && <span className={styles.phoneText}>{sub.phone}</span>}
                          {!sub.email && !sub.phone && <span className={styles.noContact}>No email/phone</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.badges}>
                          {prefs.email !== false && <Badge variant="email" size="sm">email</Badge>}
                          {prefs.push !== false && <Badge variant="push" size="sm">push</Badge>}
                          {prefs.inapp !== false && <Badge variant="inapp" size="sm">inapp</Badge>}
                          {prefs.webhook !== false && <Badge variant="webhook" size="sm">webhook</Badge>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.preferences}>
                          <span className={styles.prefItem} title="Timezone">
                            <Clock size={12} />
                            <span>{sub.timezone}</span>
                          </span>
                          <span className={styles.prefItem} title="Locale">
                            <Globe size={12} />
                            <span>{sub.locale}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            onClick={() => {
                              setEditingSubscriber(sub);
                              setIsModalOpen(true);
                            }}
                            className={styles.actionBtn}
                            title="Edit subscriber"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(sub.id, sub.externalId)}
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            title="Delete subscriber"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <SubscriberForm
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSubscriber(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={editingSubscriber}
      />
    </div>
  );
}
