'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api-client';
import { Card } from '@/components/ui/Card/Card';
import { Input, TextArea } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { CodeBlock } from '@/components/ui/CodeBlock/CodeBlock';
import { EmptyState } from '@/components/ui/EmptyState/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { 
  GitBranch, 
  Sparkles, 
  Trash2, 
  Code, 
  ChevronDown, 
  ChevronUp,
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';
import type { IRoutingRule } from '@/shared/types/domain';
import styles from './RuleBuilder.module.css';

export function RuleBuilder() {
  const { workspace } = useAuth();
  const [rules, setRules] = useState<IRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [priority, setPriority] = useState(0);
  const [active, setActive] = useState(true);

  // Expanded AST Accordion state
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});

  const fetchRules = async () => {
    if (!workspace) return;
    setLoading(true);
    const res = await apiClient.get<IRoutingRule[]>(`/api/workspaces/${workspace.id}/rules`);
    if (res.success && res.data) {
      setRules(res.data);
    } else {
      toast.error(res.error?.message || 'Failed to fetch routing rules');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, [workspace]);

  const handleCompileAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !naturalLanguage.trim() || !workspace) return;

    setCompiling(true);
    const res = await apiClient.post<IRoutingRule>(
      `/api/workspaces/${workspace.id}/rules`,
      { name, naturalLanguage, priority, active }
    );
    setCompiling(false);

    if (res.success && res.data) {
      toast.success(`Rule "${name}" compiled and saved!`);
      setName('');
      setNaturalLanguage('');
      setPriority(0);
      setActive(true);
      fetchRules();
    } else {
      toast.error(res.error?.message || 'AI compilation failed. Please verify your English syntax.');
    }
  };

  const handleDelete = async (id: string, ruleName: string) => {
    if (!workspace || !confirm(`Are you sure you want to delete rule "${ruleName}"?`)) return;

    const res = await apiClient.del(`/api/workspaces/${workspace.id}/rules/${id}`);
    if (res.success) {
      toast.success(`Rule "${ruleName}" deleted.`);
      setRules(prev => prev.filter(r => r.id !== id));
    } else {
      toast.error(res.error?.message || 'Failed to delete rule');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedRuleIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Routing Rules</h1>
          <p className={styles.subtitle}>
            Write smart filters in plain English. Varta compiles them into conditional AST branches at runtime.
          </p>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* Left Side — NL Rule Compiler Form */}
        <Card className={styles.compilerCard}>
          <h3 className={styles.cardTitle}>
            <Sparkles className={styles.sparkleIcon} />
            <span>AI Rule Compiler</span>
          </h3>

          <form onSubmit={handleCompileAndSave} className={styles.form}>
            <Input
              label="Rule Name"
              placeholder="e.g. notify_vip_only_email"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={compiling}
            />

            <TextArea
              label="Routing Logic (Plain English)"
              placeholder="If subscriber's segment is 'vip' and delivery channel is 'push', block delivery."
              value={naturalLanguage}
              onChange={e => setNaturalLanguage(e.target.value)}
              required
              rows={5}
              disabled={compiling}
            />

            <div className={styles.formRow}>
              <Input
                type="number"
                label="Priority Order"
                placeholder="0"
                value={priority}
                onChange={e => setPriority(parseInt(e.target.value) || 0)}
                disabled={compiling}
                style={{ width: '100px' }}
              />

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={e => setActive(e.target.checked)}
                  disabled={compiling}
                />
                <span>Active</span>
              </label>
            </div>

            <Button type="submit" variant="primary" loading={compiling}>
              <Sparkles size={16} />
              <span>Compile & Save</span>
            </Button>
          </form>
        </Card>

        {/* Right Side — Rules List */}
        <div className={styles.rulesColumn}>
          <h3 className={styles.listHeader}>Active Rules Queue</h3>

          {loading ? (
            <div className={styles.skeletonColumn}>
              <Skeleton height={120} />
              <Skeleton height={120} />
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              title="No rules configured"
              description="Write a rule in the left pane to route, filter, or dispatch templates conditionally."
              icon={<GitBranch />}
            />
          ) : (
            <div className={styles.list}>
              {rules.map(rule => {
                const isExpanded = !!expandedRuleIds[rule.id];

                return (
                  <Card key={rule.id} className={styles.ruleCard}>
                    <div className={styles.ruleHeader}>
                      <div className={styles.ruleHeaderInfo}>
                        <div className={styles.ruleNameRow}>
                          <h4 className={styles.ruleName}>{rule.name}</h4>
                          <span className={styles.priorityBadge}>P{rule.priority}</span>
                        </div>
                        <span className={`${styles.statusDot} ${rule.active ? styles.active : ''}`} />
                      </div>
                      <div className={styles.ruleActions}>
                        <button
                          onClick={() => toggleExpand(rule.id)}
                          className={styles.actionBtn}
                          title={isExpanded ? 'Hide AST' : 'View AST'}
                        >
                          <Code size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id, rule.name)}
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          title="Delete rule"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <p className={styles.nlDescription}>{rule.naturalLanguage}</p>

                    {isExpanded && (
                      <div className={styles.astWrapper}>
                        <span className={styles.astLabel}>Compiled AST:</span>
                        <CodeBlock
                          code={JSON.stringify(rule.ruleAst, null, 2)}
                          language="json"
                          maxHeight={200}
                        />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
