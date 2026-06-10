import { useCallback, useEffect, useState } from 'react';
import type { KenBotState } from '../state/stateMachine';
import { TIMED_STATE_DURATIONS, reduce } from '../state/stateMachine';

/**
 * Owns the live state + the timers for timed states. The pure rules live in
 * stateMachine.ts; this hook is just the plumbing around them:
 *
 * - `request(s)` asks the machine to switch states.
 * - Whenever we ENTER a timed state (greet/celebrate/point-*), schedule its
 *   timeout. Leaving the state early (effect cleanup) cancels the timer, and
 *   even if a stale timer slipped through, reduce() ignores it.
 */
export function useKenBotState(initial: KenBotState = 'idle'): {
  state: KenBotState;
  request: (next: KenBotState) => void;
} {
  const [state, setState] = useState<KenBotState>(initial);

  const request = useCallback((next: KenBotState): void => {
    setState((current) => reduce(current, { type: 'request', state: next }));
  }, []);

  useEffect(() => {
    const duration = TIMED_STATE_DURATIONS[state];
    if (duration === undefined) return; // persistent state — no timer
    const timer = setTimeout(() => {
      setState((current) => reduce(current, { type: 'timeout', state }));
    }, duration);
    return () => clearTimeout(timer);
  }, [state]);

  return { state, request };
}

/**
 * Fake mouth movement for the talking state until real audio exists.
 * Phase 4 replaces this with amplitude from a Web Audio AnalyserNode; this
 * stays as the fallback when TTS is muted or unavailable (captions-only mode
 * should still show him "speaking").
 *
 * ~9 updates/second of mostly-open values with occasional closed "word gaps"
 * reads as cartoon lip flap.
 */
export function useFakeTalk(active: boolean): number {
  const [mouth, setMouth] = useState(0);

  useEffect(() => {
    if (!active) {
      setMouth(0);
      return;
    }
    const timer = setInterval(() => {
      setMouth(Math.random() < 0.18 ? 0.05 : 0.15 + Math.random() * 0.65);
    }, 110);
    return () => {
      clearInterval(timer);
      setMouth(0);
    };
  }, [active]);

  return mouth;
}
