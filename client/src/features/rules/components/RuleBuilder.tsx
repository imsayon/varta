'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { apiClient } from '@/shared/api/api';
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
  Code
} from 'lucide-react';
import { toast } from 'sonner';
import type { IRoutingRule } from '@/shared/types/domain';
import type { JsonObject } from '@/shared/types/json';
import styles from './RuleBuilder.module.css';

export function RuleBuilder() {
  const { workspace } = useAuth();
  const [rules, setRules] = useState<IRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [aiStatus, setAiStatus] = useState({ available: false, reason: 'Checking AI availability…' });

  // Form Fields
  const [name, setName] = useState('');
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [priority, setPriority] = useState(0);
  const [active, setActive] = useState(true);
  const [ruleAst, setRuleAst] = useState('{\n  "logic": "AND",\n  "conditions": [],\n  "channels": ["EMAIL"]\n}');
  const [proposalNote, setProposalNote] = useState<string | null>(null);

  // Expanded AST Accordion state
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!workspace) return;

    void (async () => {
      setLoading(true);
      const availability = await apiClient.get<{ available: boolean; reason?: string }>(`/api/v1/workspaces/${workspace.id}/routing-rules/availability`);
      setAiStatus(availability.success ? { available: availability.data.available, reason: availability.data.reason || '' } : { available: false, reason: 'AI is currently unavailable. Use the JSON editor below.' });
      const res = await apiClient.get<IRoutingRule[]>(`/api/v1/workspaces/${workspace.id}/routing-rules`);
      if (res.success) {
        setRules(res.data);
      } else {
        toast.error(res.error?.message || 'Failed to fetch routing rules');
      }
      setLoading(false);
    })();
  }, [workspace]);

  const handleCompile = async () => {
    if (!aiStatus.available || !naturalLanguage.trim() || !workspace) return;
    setCompiling(true);
    const res = await apiClient.post<{ ast: JsonObject; explanation?: string }>(
      `/api/v1/workspaces/${workspace.id}/routing-rules/compile`,
      { naturalLanguage },
    );
    setCompiling(false);
    if (res.success) {
      setRuleAst(JSON.stringify(res.data.ast, null, 2));
      setProposalNote(res.data.explanation || 'Review this proposal before saving.');
    } else toast.error(res.error.message);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workspace) return;

    let parsedAst: JsonObject;
    try {
      const parsed: unknown = JSON.parse(ruleAst);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      parsedAst = parsed as JsonObject;
    } catch {
      toast.error('Rule AST must be a valid JSON object.');
      return;
    }

    setCompiling(true);
    const res = await apiClient.post<IRoutingRule>(
      `/api/v1/workspaces/${workspace.id}/routing-rules`,
      { name, naturalLanguage: naturalLanguage || null, ruleAst: parsedAst, priority, isActive: active }
    );
    setCompiling(false);

      if (res.success) {
      toast.success(`Rule "${name}" saved.`);
      setName('');
      setNaturalLanguage('');
      setPriority(0);
      setActive(true);
      setProposalNote(null);
      if (!workspace) return;
      const refreshRes = await apiClient.get<IRoutingRule[]>(`/api/v1/workspaces/${workspace.id}/routing-rules`);
      if (refreshRes.success && refreshRes.data) {
        setRules(refreshRes.data);
      }
    } else {
      toast.error(res.error?.message || 'Failed to save routing rule.');
    }
  };

  const handleToggle = async (rule: IRoutingRule) => {
    if (!workspace) return;
    const res = await apiClient.patch<IRoutingRule>(`/api/v1/workspaces/${workspace.id}/routing-rules/${rule.id}`, { isActive: !rule.isActive });
    if (res.success) setRules((current) => current.map((item) => item.id === rule.id ? res.data : item));
    else toast.error(res.error.message);
  };

  const handleDelete = async (id: string, ruleName: string) => {
    if (!workspace || !confirm(`Are you sure you want to delete rule "${ruleName}"?`)) return;

    const res = await apiClient.del(`/api/v1/workspaces/${workspace.id}/routing-rules/${id}`);
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
            Create deterministic, priority-ordered rules. AI can propose an AST, but never saves or activates it.
          </p>
        </div>
      </div>

      <div className={styles.layoutGrid}>
        {/* Left Side — NL Rule Compiler Form */}
        <Card className={styles.compilerCard}>
          <h3 className={styles.cardTitle}>
            <Sparkles className={styles.sparkleIcon} />
            <span>Rule editor</span>
          </h3>

          {!aiStatus.available && <p role="status">{aiStatus.reason}</p>}
          <form onSubmit={handleSave} className={styles.form}>
            <Input
              label="Rule Name"
              placeholder="e.g. notify_vip_only_email"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={compiling}
            />

            <Button type="button" variant="secondary" loading={compiling} onClick={() => void handleCompile()} disabled={!naturalLanguage.trim() || !aiStatus.available}>
              <Sparkles size={16} /><span>Generate review-only proposal</span>
            </Button>
            {proposalNote && <p role="status" className={styles.nlDescription}>{proposalNote}</p>}

            <TextArea
              label="Rule AST (review before saving)"
              value={ruleAst}
              onChange={event => setRuleAst(event.target.value)}
              rows={10}
              mono
              required
              disabled={compiling}
            />

            <TextArea
              label="Routing Logic (Plain English)"
              placeholder="If the subscriber plan is vip, use email and in-app."
              value={naturalLanguage}
              onChange={e => setNaturalLanguage(e.target.value)}
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
              <span>Save reviewed rule</span>
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
                        <span className={`${styles.statusDot} ${rule.isActive ? styles.isActive : ''}`} />
                      </div>
                      <div className={styles.ruleActions}>
                        <button
                          onClick={() => toggleExpand(rule.id)}
                          className={styles.actionBtn}
                          title={isExpanded ? 'Hide AST' : 'View AST'}
                        >
                          <Code size={16} />
                        </button>
                        <button onClick={() => void handleToggle(rule)} className={styles.actionBtn} title={rule.isActive ? 'Deactivate rule' : 'Activate rule'}>
                          {rule.isActive ? 'On' : 'Off'}
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
