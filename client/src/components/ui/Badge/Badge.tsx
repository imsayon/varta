'use client';

import styles from './Badge.module.css';
import { Mail, Bell, Smartphone, Webhook } from 'lucide-react';

type BadgeVariant = 'email' | 'inapp' | 'push' | 'webhook' | 'default' | 'success' | 'error' | 'warning';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: boolean;
  size?: 'sm' | 'md';
}

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail size={11} />,
  inapp: <Bell size={11} />,
  push: <Smartphone size={11} />,
  webhook: <Webhook size={11} />,
};

export function Badge({ variant = 'default', children, icon = false, size = 'sm' }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${styles[size]}`}>
      {icon && channelIcons[variant]}
      {children}
    </span>
  );
}
