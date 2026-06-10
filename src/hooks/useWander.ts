import { useEffect, useRef, useState } from 'react';
import type { KenBotState } from '../state/stateMachine';

/**
 * The wander brain: every so often while idle, KenBot strolls a little way
 * along the screen edge, pauses, and (usually) heads home again later.
 *
 * Split of responsibilities:
 * - This hook decides WHEN and WHERE to walk, moves the widget by returning a
 *   `transform: translateX(...)` style (tweened by a CSS transition at a
 *   constant walking speed), and flips the state machine between idle and
 *   walking at departure/arrival.
 * - The leg/arm/bob walk cycle is pure CSS, keyed off the kb-state-walking
 *   class (see kenbot.css).
 *
 * If something interrupts a stroll (the chat opens, the host triggers
 * celebrate), the planning stops and he glides home quickly so the gesture
 * plays at his home corner.
 */

const WALK_SPEED_PX_PER_S = 50;
const MIN_PAUSE_MS = 6_000;
const MAX_PAUSE_MS = 16_000;
const MIN_STROLL_PX = 40;

export function useWander(args: {
  /** Master switch — wander prop AND not reduced-motion. */
  enabled: boolean;
  state: KenBotState;
  request: (next: KenBotState) => void;
  /** Farthest he'll stroll from his home corner, in px. */
  range: number;
  /** -1 = stroll left of home (bottom-right corner), +1 = stroll right. */
  direction: -1 | 1;
}): React.CSSProperties {
  const { enabled, state, request, range, direction } = args;

  const [offset, setOffset] = useState(0);
  const [transition, setTransition] = useState('none');

  // Refs let the timer callbacks read fresh values without re-arming effects.
  const offsetRef = useRef(0);
  offsetRef.current = offset;
  // Set when WE start a walk (so a manually-triggered walking state from the
  // demo or a host just marches in place instead of instantly idling out).
  const plannedWalkMs = useRef<number | null>(null);

  // While idle: wait a random pause, then pick a destination and go.
  useEffect(() => {
    if (!enabled || state !== 'idle') return;
    const timer = setTimeout(
      () => {
        const from = offsetRef.current;
        const headHome = from !== 0 && Math.random() < 0.6;
        const target = headHome ? 0 : direction * (MIN_STROLL_PX + Math.random() * Math.max(0, range - MIN_STROLL_PX));
        const distance = Math.abs(target - from);
        if (distance < 8) return; // new spot is basically where he stands — skip this round
        const seconds = distance / WALK_SPEED_PX_PER_S;
        plannedWalkMs.current = seconds * 1000;
        setTransition(`transform ${seconds.toFixed(2)}s linear`);
        setOffset(target);
        request('walking');
      },
      MIN_PAUSE_MS + Math.random() * (MAX_PAUSE_MS - MIN_PAUSE_MS),
    );
    return () => clearTimeout(timer);
  }, [enabled, state, direction, range, request, offset]);

  // While walking (a walk WE planned): go idle on arrival. Leaving the state
  // early cleans the timer up.
  useEffect(() => {
    if (state !== 'walking' || plannedWalkMs.current === null) return;
    const ms = plannedWalkMs.current + 80; // small pad so the slide finishes first
    const timer = setTimeout(() => {
      plannedWalkMs.current = null;
      request('idle');
    }, ms);
    return () => clearTimeout(timer);
  }, [state, request]);

  // Interruptions: a stroll ended by anything other than arrival (chat opened,
  // celebrate fired, wander toggled off) → glide home quickly.
  useEffect(() => {
    const interrupted = state !== 'idle' && state !== 'walking';
    if (interrupted || !enabled) {
      plannedWalkMs.current = null;
      if (offsetRef.current !== 0) {
        setTransition('transform 0.5s ease-out');
        setOffset(0);
      }
    }
  }, [state, enabled]);

  return { transform: `translateX(${offset}px)`, transition };
}
