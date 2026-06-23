'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '@/shared/hooks/use-animated-counter';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  color: 'indigo' | 'emerald' | 'rose' | 'cyan' | 'purple';
  suffix?: string;
  prefix?: string;
  delay?: number;
}

export function StatCard({ label, value, icon, color, suffix = '', prefix = '', delay = 0 }: StatCardProps) {
  const animatedValue = useAnimatedCounter(value, 1500);

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
    >
      <div className={`${styles.iconBox} ${styles[`icon_${color}`]}`}>
        {icon}
      </div>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <h3 className={styles.value}>
          {prefix}{animatedValue.toLocaleString()}{suffix}
        </h3>
      </div>
    </motion.div>
  );
}
