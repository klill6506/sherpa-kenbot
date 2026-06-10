import { useEffect, useState } from 'react';

/**
 * The "idle life" hooks: random blinks and occasional glances.
 * These run constantly regardless of animation state — even a thinking or
 * talking character still blinks, which is a big part of feeling alive.
 *
 * Both hooks work the same way: a self-rescheduling setTimeout chain with a
 * random delay each round, so the rhythm never looks mechanical.
 */

/** Random integer between min and max (inclusive-ish, good enough for timers). */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns 1 (eyes open) or 0 (mid-blink). A blink holds 0 for ~120ms.
 * Humans blink every 2–6 seconds and occasionally double-blink, so we do too.
 */
export function useBlink(): number {
  const [eyesOpen, setEyesOpen] = useState(1);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const closeThenOpen = (onDone: () => void): void => {
      setEyesOpen(0);
      timer = setTimeout(() => {
        if (cancelled) return;
        setEyesOpen(1);
        onDone();
      }, 120);
    };

    const scheduleNext = (): void => {
      timer = setTimeout(() => {
        if (cancelled) return;
        const isDoubleBlink = Math.random() < 0.2;
        closeThenOpen(() => {
          if (cancelled) return;
          if (isDoubleBlink) {
            // Brief open pause, then the second blink of the pair.
            timer = setTimeout(() => {
              if (cancelled) return;
              closeThenOpen(scheduleNext);
            }, 140);
          } else {
            scheduleNext();
          }
        });
      }, randomBetween(2200, 6000));
    };

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return eyesOpen;
}

/**
 * Returns a pupil offset ({x, y} each -1..1) that wanders occasionally —
 * a quick look to the side, hold a moment, then back to center.
 * Pass enabled=false (e.g. user prefers reduced motion) to stay centered.
 */
export function useGlance(enabled: boolean): { x: number; y: number } {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const scheduleNext = (): void => {
      timer = setTimeout(() => {
        if (cancelled) return;
        // Glance somewhere (mostly sideways, slight vertical drift)...
        setOffset({ x: randomBetween(-1, 1), y: randomBetween(-0.4, 0.5) });
        // ...hold it briefly, then return to center and wait for the next one.
        timer = setTimeout(() => {
          if (cancelled) return;
          setOffset({ x: 0, y: 0 });
          scheduleNext();
        }, randomBetween(700, 1600));
      }, randomBetween(3500, 9000));
    };

    scheduleNext();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled]);

  return offset;
}
