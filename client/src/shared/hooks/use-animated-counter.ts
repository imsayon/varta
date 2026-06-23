'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to the target value using requestAnimationFrame.
 * Uses an ease-out cubic easing for natural deceleration.
 */
export function useAnimatedCounter(target: number, duration: number = 1200): number {
  const [current, setCurrent] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = null;

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      setCurrent(Math.round(easedProgress * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);

  return current;
}
