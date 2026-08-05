'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/shared/auth/auth-context';
import styles from './Header.module.css';

export function Header() {
  const pathname = usePathname();
  const { workspace, apiKey } = useAuth();

  // Get display title based on path
  const getTitle = () => {
    switch (pathname) {
      case '/analytics':
        return 'Analytics';
      case '/templates':
        return 'Templates';
      case '/rules':
        return 'Routing Rules';
      case '/workflows':
        return 'Workflows';
      case '/api-keys':
        return 'API Keys';
      case '/subscribers':
        return 'Subscribers';
      case '/studio':
        return 'Trigger Studio';
      case '/settings':
        return 'Settings';
      default:
        return 'Varta';
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <h2 className={styles.title}>{getTitle()}</h2>
        {workspace && (
          <span className={styles.workspaceIndicator}>
            {workspace.name}
          </span>
        )}
      </div>

      <div className={styles.right}>
        {/* API Key Badge */}
        {apiKey ? (
          <div className={styles.apiKeyBadge}>
            <span className={styles.keyLabel}>API:</span>
            <span className={styles.keyValue}>varta_live_••••{apiKey.slice(-6)}</span>
          </div>
        ) : (
          <div className={`${styles.apiKeyBadge} ${styles.noKey}`}>
            <span>No API Key</span>
          </div>
        )}

      </div>
    </header>
  );
}
