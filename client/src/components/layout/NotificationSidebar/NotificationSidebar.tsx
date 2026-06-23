'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, BellOff, CheckCheck, Wifi } from 'lucide-react';
import type { IWSNotification } from '@/shared/types/domain';
import styles from './NotificationSidebar.module.css';

interface NotificationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: IWSNotification[];
  isConnected: boolean;
  onMarkAllRead: () => void;
}

export function NotificationSidebar({ 
  isOpen, 
  onClose, 
  notifications, 
  isConnected, 
  onMarkAllRead 
}: NotificationSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer Panel -> Popover */}
          <motion.div 
            className={styles.popover}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.titleArea}>
                <h3 className={styles.title}>Real-time Feed</h3>
                <div className={`${styles.statusDot} ${isConnected ? styles.connected : ''}`}>
                  <Wifi size={12} />
                  <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
              </div>
              <button onClick={onClose} className={styles.closeButton}>
                <X size={20} />
              </button>
            </div>

            {/* Actions Bar */}
            {notifications.length > 0 && (
              <div className={styles.actionsBar}>
                <span className={styles.countText}>{notifications.length} received</span>
                <button onClick={onMarkAllRead} className={styles.markReadBtn}>
                  <CheckCheck size={16} />
                  <span>Clear Badge</span>
                </button>
              </div>
            )}

            {/* List Content */}
            <div className={styles.content}>
              {notifications.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>
                    <BellOff size={32} />
                  </div>
                  <h4>No notifications yet</h4>
                  <p>Trigger a notification payload in the Studio tab to see it appear here in real time.</p>
                </div>
              ) : (
                <div className={styles.list}>
                  {notifications.map((notif, index) => (
                    <div key={index} className={styles.item}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemTitle}>{notif.title}</span>
                        {notif.timestamp && (
                          <span className={styles.itemTime}>
                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className={styles.itemBody}>{notif.body}</p>
                      {notif.actionUrl && (
                        <a 
                          href={notif.actionUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className={styles.actionLink}
                        >
                          View Action
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
