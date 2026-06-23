'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  BarChart3, 
  FileCode, 
  GitBranch, 
  Users, 
  Rocket, 
  Settings, 
  LogOut, 
  ChevronRight,
  Plus
} from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import { useState, useEffect } from 'react';
import { apiClient } from '@/shared/api/api-client';
import type { IWorkspace } from '@/shared/types/domain';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, setActiveWorkspace, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<IWorkspace[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [isCreatingWs, setIsCreatingWs] = useState(false);

  const navItems = [
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Templates', href: '/templates', icon: FileCode },
    { name: 'Workflows', href: '/workflows', icon: GitBranch },
    { name: 'Routing Rules', href: '/rules', icon: FileCode }, // Just changing icon here or keeping it
    { name: 'Subscribers', href: '/subscribers', icon: Users },
    { name: 'Trigger Studio', href: '/studio', icon: Rocket },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Fetch workspaces list
  useEffect(() => {
    async function loadWorkspaces() {
      const res = await apiClient.get<IWorkspace[]>('/api/workspaces');
      if (res.success && res.data) {
        setWorkspaces(res.data);
        // If no active workspace is selected, but workspaces exist, select the first one
        if (!workspace && res.data.length > 0) {
          setActiveWorkspace({ id: res.data[0]._id, name: res.data[0].name });
        }
      }
    }
    loadWorkspaces();
  }, [workspace, setActiveWorkspace]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    const res = await apiClient.post<IWorkspace>('/api/workspaces', { name: newWsName });
    if (res.success && res.data) {
      setWorkspaces(prev => [...prev, res.data!]);
      setActiveWorkspace({ id: res.data._id, name: res.data.name });
      setNewWsName('');
      setIsCreatingWs(false);
      setIsDropdownOpen(false);
    }
  };

  return (
    <aside className={styles.sidebar}>
      {/* Brand Header */}
      <div className={styles.brand}>
        <div className={styles.logoIcon}>
          <span>V</span>
        </div>
        <h1 className={styles.logoText}>
          Varta<span>.</span>
        </h1>
      </div>

      {/* Workspace Switcher */}
      <div className={styles.workspaceSection}>
        <button 
          className={styles.workspaceTrigger}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        >
          <div className={styles.workspaceInfo}>
            <span className={styles.workspaceLabel}>Workspace</span>
            <span className={styles.workspaceName}>
              {workspace ? workspace.name : 'Select Workspace'}
            </span>
          </div>
          <ChevronRight className={`${styles.chevron} ${isDropdownOpen ? styles.chevronOpen : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownList}>
              {workspaces.map(ws => (
                <button
                  key={ws._id}
                  className={`${styles.dropdownItem} ${workspace?.id === ws._id ? styles.dropdownItemActive : ''}`}
                  onClick={() => {
                    setActiveWorkspace({ id: ws._id, name: ws.name });
                    setIsDropdownOpen(false);
                    // Force refresh or redirect to reset state for new workspace context
                    router.push('/analytics');
                  }}
                >
                  {ws.name}
                </button>
              ))}
            </div>

            {isCreatingWs ? (
              <form onSubmit={handleCreateWorkspace} className={styles.createForm}>
                <input
                  type="text"
                  placeholder="New Workspace name"
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  className={styles.createInput}
                  autoFocus
                />
                <div className={styles.formActions}>
                  <button type="button" onClick={() => setIsCreatingWs(false)} className={styles.cancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitBtn}>
                    Create
                  </button>
                </div>
              </form>
            ) : (
              <button 
                className={styles.addWorkspaceBtn}
                onClick={() => setIsCreatingWs(true)}
              >
                <Plus size={16} />
                <span>Create Workspace</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className={styles.nav}>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              {isActive && (
                <motion.div 
                  layoutId="activeNavIndicator"
                  className={styles.activeIndicator}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon size={20} className={styles.navIcon} />
              <span className={styles.navText}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Sign Out */}
      <div className={styles.footer}>
        <button onClick={logout} className={styles.signOutBtn}>
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
