'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  code: string;
  language?: string;
  maxHeight?: string | number;
}

export function CodeBlock({ code, language = 'json', maxHeight }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.language}>{language}</span>
        <button onClick={handleCopy} className={styles.copyButton} title="Copy code">
          {copied ? <Check className={styles.checkIcon} /> : <Copy className={styles.copyIcon} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className={styles.pre} style={maxHeight ? { maxHeight } : undefined}>
        <code className={styles.code}>{code}</code>
      </pre>
    </div>
  );
}
