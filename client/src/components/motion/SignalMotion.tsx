'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { animate, createScope, onScroll, stagger } from 'animejs';
import styles from './SignalMotion.module.css';

export function useSignalReveal<T extends HTMLElement>() {
  const root = useRef<T>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const scope = createScope({
      root: element,
      mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' },
    });

    scope.add((self) => {
      const reveal = () => {
        if (element.dataset.signalRevealed === 'true') return;
        element.dataset.signalRevealed = 'true';
        scope.execute(() => animate(element, {
          opacity: [0, 1],
          translateY: [22, 0],
          duration: 680,
          ease: 'out(3)',
        }));
      };

      if (self?.matches.reduceMotion) {
        element.style.opacity = '1';
        element.style.transform = 'none';
        return;
      }

      element.style.opacity = '0';
      if (element.getBoundingClientRect().top < window.innerHeight * 0.9) {
        reveal();
        return;
      }

      onScroll({
        target: element,
        enter: 'top 88%',
        onEnter: reveal,
      });
    });

    return () => scope.revert();
  }, []);

  return root;
}

export function useSignalScene<T extends HTMLElement>() {
  const root = useRef<T>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const scope = createScope({
      root: element,
      mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' },
    });

    scope.add((self) => {
      const candidates = new Set<HTMLElement>();
      element.querySelectorAll<HTMLElement>(
        '[data-signal-item], .dashboard-header, .dashboard-toolbar, .dashboard-card, .dashboard-table-card',
      ).forEach((item) => candidates.add(item));
      Array.from(element.children).forEach((child) => {
        if (child instanceof HTMLElement) candidates.add(child);
      });

      const items = Array.from(candidates);
      if (self?.matches.reduceMotion) {
        items.forEach((item) => {
          item.style.opacity = '1';
          item.style.transform = 'none';
        });
        return;
      }

      items.forEach((item) => { item.style.opacity = '0'; });
      animate(items, {
        opacity: [0, 1],
        translateY: [14, 0],
        delay: stagger(55),
        duration: 520,
        ease: 'out(3)',
      });
    });

    return () => scope.revert();
  }, []);

  return root;
}

type SignalRailProps = {
  compact?: boolean;
  label?: string;
  className?: string;
};

export function SignalRail({ compact = false, label = 'LIVE EVENT ROUTE', className = '' }: SignalRailProps) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const scope = createScope({
      root: element,
      mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' },
    });

    scope.add((self) => {
      const nodes = Array.from(element.querySelectorAll<HTMLElement>('[data-signal-node]'));

      if (self?.matches.reduceMotion) {
        nodes.forEach((node) => {
          node.style.opacity = '0.8';
          node.style.transform = 'translateX(0)';
        });
        return;
      }

      onScroll({
        target: element,
        sync: true,
        onUpdate: (observer) => {
          element.style.setProperty('--signal-progress', String(observer.progress));
        },
      });

      nodes.forEach((node, index) => {
        const lane = node.parentElement;
        if (!lane) return;
        animate(node, {
          translateX: () => [0, Math.max(lane.clientWidth - node.offsetWidth - 2, 24)],
          opacity: [0.22, 1],
          duration: (compact ? 2200 : 2600) + index * 180,
          delay: index * 360,
          ease: 'linear',
          loop: true,
        });
      });
    });

    return () => scope.revert();
  }, [compact]);

  return (
    <div ref={root} className={`${styles.rail} ${compact ? styles.compact : ''} ${className}`} aria-hidden="true">
      <div className={styles.railHeader}>
        <span>{label}</span>
        <span className={styles.railState}><i /> stable / 24ms</span>
      </div>
      <div className={styles.trackStack}>
        {[0, 1, 2].map((lane) => (
          <div className={styles.track} data-signal-lane="true" key={lane}>
            <span className={styles.node} data-signal-node="true" />
          </div>
        ))}
      </div>
      {!compact && <div className={styles.railFooter}>ingest <span /> normalize <span /> route <span /> deliver</div>}
    </div>
  );
}

export function SignalScene({ children }: { children: ReactNode }) {
  const root = useSignalScene<HTMLDivElement>();
  return <div ref={root} className="signal-scene">{children}</div>;
}
