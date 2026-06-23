'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import styles from './Card.module.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function Card({ children, className, hover = true, padding = 'md', onClick }: CardProps) {
  const paddingClass = styles[`padding_${padding}`];

  if (hover) {
    return (
      <motion.div
        className={`${styles.card} ${paddingClass} ${className || ''}`}
        whileHover={{ y: -2, borderColor: 'rgba(99, 102, 241, 0.25)' }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${styles.card} ${paddingClass} ${className || ''}`} onClick={onClick}>
      {children}
    </div>
  );
}
