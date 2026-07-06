'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
import { Card } from '@/components/ui/Card/Card';
import { Button } from '@/components/ui/Button/Button';
import { Badge } from '@/components/ui/Badge/Badge';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { TemplateForm } from '@/features/templates/components/TemplateForm';
import { 
  FileCode, 
  Plus, 
  Search, 
  Sparkles, 
  Edit2, 
  Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import type { BadgeVariant } from '@/components/ui/Badge/Badge';
import type { ITemplate, ITemplateListData, TemplateUpsertInput } from '@/shared/types/domain';
import styles from './TemplatesPage.module.css';

export default function TemplatesPage() {
  const { workspace } = useAuth();
  const [templates, setTemplates] = useState<ITemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ITemplate | null>(null);

  useEffect(() => {
    if (!workspace) return;

    void (async () => {
      setLoading(true);
      const res = await apiClient.get<ITemplateListData>(`/api/v1/workspaces/${workspace.id}/templates`);
      if (res.success && res.data) {
        setTemplates(res.data.templates);
      } else {
        toast.error(res.error?.message || 'Failed to fetch templates');
      }
      setLoading(false);
    })();
  }, [workspace]);

  const handleCreateOrUpdate = async (formData: TemplateUpsertInput) => {
    if (!workspace) return;

    if (editingTemplate) {
      // Update
      const res = await apiClient.patch<ITemplate>(
        `/api/v1/workspaces/${workspace.id}/templates/${editingTemplate.id}`,
        formData
      );
      if (res.success) {
        toast.success(`Template "${formData.name}" updated successfully!`);
        const refreshRes = await apiClient.get<ITemplateListData>(`/api/v1/workspaces/${workspace.id}/templates`);
        if (refreshRes.success && refreshRes.data) {
          setTemplates(refreshRes.data.templates);
        }
      } else {
        toast.error(res.error?.message || 'Failed to update template');
        throw new Error();
      }
    } else {
      // Create
      const res = await apiClient.post<ITemplate>(
        `/api/v1/workspaces/${workspace.id}/templates`,
        formData
      );
      if (res.success) {
        toast.success(`Template "${formData.name}" created successfully!`);
        const refreshRes = await apiClient.get<ITemplateListData>(`/api/v1/workspaces/${workspace.id}/templates`);
        if (refreshRes.success && refreshRes.data) {
          setTemplates(refreshRes.data.templates);
        }
      } else {
        toast.error(res.error?.message || 'Failed to create template');
        throw new Error();
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!workspace || !confirm(`Are you sure you want to delete template "${name}"?`)) return;

    const res = await apiClient.del(`/api/v1/workspaces/${workspace.id}/templates/${id}`);
    if (res.success) {
      toast.success(`Template "${name}" deleted.`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } else {
      toast.error(res.error?.message || 'Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Templates</h1>
          <p className={styles.subtitle}>Define layouts and message copies for multi-channel sends</p>
        </div>
        <Button 
          variant="primary" 
          onClick={() => {
            setEditingTemplate(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={18} />
          <span>New Template</span>
        </Button>
      </div>

      {/* Controls Bar */}
      {templates.length > 0 && (
        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search templates by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      )}

      {/* Templates List */}
      {loading ? (
        <div className={styles.grid}>
          <Skeleton height={200} />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className={styles.emptyContainer}>
          <EmptyState
            title={search ? 'No matches found' : 'No templates created'}
            description={search ? 'Try adjusting your search query.' : 'Get started by creating your first multi-channel notification template.'}
            icon={<FileCode />}
            actionLabel={search ? undefined : 'New Template'}
            onAction={search ? undefined : () => setIsModalOpen(true)}
          />
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredTemplates.map(template => {
            const channelNames = Object.keys(template.channels);

            return (
              <Card key={template.id} className={styles.card} hover>
                <div className={styles.cardHeader}>
                  <div className={styles.nameArea}>
                    <h3 className={styles.templateName}>{template.name}</h3>
                    {template.aiPersonalize && (
                      <span className={styles.aiBadge} title="AI content optimization enabled">
                        <Sparkles size={12} />
                        <span>AI</span>
                      </span>
                    )}
                  </div>
                  <span className={`${styles.statusDot} ${template.isActive ? styles.isActive : ''}`} />
                </div>

                <div className={styles.channelsArea}>
                  <span className={styles.label}>Configured Channels:</span>
                  <div className={styles.badgesGrid}>
                    {channelNames.map(ch => (
                      <Badge key={ch} variant={ch as BadgeVariant} size="sm">
                        {ch}
                      </Badge>
                    ))}
                    {channelNames.length === 0 && (
                      <span className={styles.noChannels}>No channels configured</span>
                    )}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span className={styles.timestamp}>
                    Updated {new Date(template.updatedAt).toLocaleDateString()}
                  </span>
                  <div className={styles.actions}>
                    <button
                      onClick={() => {
                        setEditingTemplate(template);
                        setIsModalOpen(true);
                      }}
                      className={styles.actionBtn}
                      title="Edit template"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id, template.name)}
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      title="Delete template"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <TemplateForm
          key={editingTemplate?.id ?? 'create-template'}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTemplate(null);
          }}
          onSubmit={handleCreateOrUpdate}
          initialData={editingTemplate}
        />
      )}
    </div>
  );
}
