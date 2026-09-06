'use client';

import { type ReactNode } from 'react';
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

  return (
    <div className={`${styles.card} ${hover ? styles.hoverable : ''} ${paddingClass} ${className || ''}`} onClick={onClick}>
      {children}
    </div>
  );
}
