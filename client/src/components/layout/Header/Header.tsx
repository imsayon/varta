'use client';

import { usePathname } from 'next/navigation';
import { Bell, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import styles from './Header.module.css';

interface HeaderProps {
  unreadCount: number;
  isConnected: boolean;
  onToggleNotifications: () => void;
}

export function Header({ unreadCount, isConnected, onToggleNotifications }: HeaderProps) {
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
        {/* Connection status badge */}
        <div className={`${styles.statusBadge} ${isConnected ? styles.connected : styles.disconnected}`}>
          {isConnected ? (
            <>
              <Wifi size={14} />
              <span>WS Live</span>
            </>
          ) : (
            <>
              <WifiOff size={14} />
              <span>Offline</span>
            </>
          )}
        </div>

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

        {/* Notification Bell */}
        <button 
          onClick={onToggleNotifications} 
          className={styles.bellButton}
          aria-label="Toggle notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className={styles.unreadBadge}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
