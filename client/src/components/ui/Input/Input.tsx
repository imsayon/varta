'use client';

import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, mono, className, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    return (
      <div className={styles.wrapper}>
        {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}
        <input
          id={inputId}
          ref={ref}
          aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={`${styles.input} ${error ? styles.error : ''} ${mono ? styles.mono : ''} ${className || ''}`}
          {...props}
        />
        {error && <span id={errorId} className={styles.errorText} role="alert" aria-live="polite">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';

/* Textarea variant */
interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, mono, className, id, 'aria-describedby': describedBy, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    return (
      <div className={styles.wrapper}>
        {label && <label className={styles.label} htmlFor={inputId}>{label}</label>}
        <textarea
          id={inputId}
          ref={ref}
          aria-describedby={[describedBy, error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
          aria-invalid={error ? true : undefined}
          className={`${styles.input} ${styles.textarea} ${error ? styles.error : ''} ${mono ? styles.mono : ''} ${className || ''}`}
          {...props}
        />
        {error && <span id={errorId} className={styles.errorText} role="alert" aria-live="polite">{error}</span>}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';
